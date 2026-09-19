/* Bozorchi AI — platform admin panel. Plain JS, talks to /admin/api/* with the x-admin-key header. */
const $ = (s, r = document) => r.querySelector(s);
const main = $("#main");
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const uzs = (n) => `${fmt(Math.round(n || 0))} UZS`;
/** Compact money for KPI tiles: 1.28 bn / 41.7 mln / 12,500 — full value in the tooltip. */
const uzsK = (n) => { n = Number(n || 0); const a = Math.abs(n); const v = a >= 1e9 ? `${(n / 1e9).toFixed(2)} bn` : a >= 1e6 ? `${(n / 1e6).toFixed(1)} mln` : fmt(Math.round(n)); return `<span title="${uzs(n)}">${v} <small>UZS</small></span>`; };
const usd = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const ago = (d) => { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let key = localStorage.getItem("bozorchi:adminKey") || "";
let window_ = localStorage.getItem("bozorchi:adminWindow") || "7d";
let page = "overview";
let charts = [];

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2200); }
async function api(path, opts = {}) {
  const r = await fetch(`/admin/api${path}`, { ...opts, headers: { "content-type": "application/json", "x-admin-key": key, ...(opts.headers || {}) } });
  if (r.status === 401) { showLogin("Wrong password"); throw new Error("unauthorized"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
function showLogin(err = "") { $("#shell").classList.add("hidden"); $("#login").classList.remove("hidden"); $("#loginErr").textContent = err; $("#pw").focus(); }
$("#loginForm").addEventListener("submit", async (e) => { e.preventDefault(); key = $("#pw").value; localStorage.setItem("bozorchi:adminKey", key); try { await api("/stats?window=24h"); boot(); } catch { showLogin("Wrong password"); } });
$("#logout").addEventListener("click", () => { key = ""; localStorage.removeItem("bozorchi:adminKey"); showLogin(); });
$("#nav").addEventListener("click", (e) => { const a = e.target.closest("a[data-page]"); if (!a) return; e.preventDefault(); go(a.dataset.page); });

async function boot() {
  $("#login").classList.add("hidden"); $("#shell").classList.remove("hidden");
  fetch("/health").then((r) => r.json()).then((h) => { const p = $("#health"); p.textContent = `● API ${h.status || "ok"}`; p.className = "pill ok"; }).catch(() => { const p = $("#health"); p.textContent = "● API down"; p.className = "pill bad"; });
  go(location.hash.slice(1) || "overview");
}
function go(p) { page = p; location.hash = p; document.querySelectorAll("#nav a[data-page]").forEach((a) => a.classList.toggle("active", a.dataset.page === p)); charts.forEach((c) => c.destroy()); charts = []; main.innerHTML = `<p class="muted">Loading…</p>`; (PAGES[p] || PAGES.overview)().catch((e) => { main.innerHTML = `<p class="err">${esc(e.message)}</p>`; }); }

const windowSeg = () => `<div class="seg">${["24h", "7d", "30d", "90d", "all"].map((w) => `<button data-w="${w}" class="${w === window_ ? "on" : ""}">${w}</button>`).join("")}</div>`;
function bindWindow(root, rerender) { root.querySelectorAll("[data-w]").forEach((b) => b.addEventListener("click", () => { window_ = b.dataset.w; localStorage.setItem("bozorchi:adminWindow", window_); rerender(); })); }
const kpi = (l, v, s = "") => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
function lineChart(el, labels, datasets) { const c = new Chart(el, { type: "line", data: { labels, datasets: datasets.map((d) => ({ tension: .35, borderWidth: 2, pointRadius: 2, fill: true, ...d })) }, options: { plugins: { legend: { labels: { color: "#8b94a7" } } }, scales: { x: { ticks: { color: "#8b94a7" }, grid: { color: "#262c3a" } }, y: { ticks: { color: "#8b94a7" }, grid: { color: "#262c3a" }, beginAtZero: true } } } }); charts.push(c); return c; }
function doughnut(el, labels, data, colors) { const c = new Chart(el, { type: "doughnut", data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { plugins: { legend: { position: "right", labels: { color: "#8b94a7" } } } } }); charts.push(c); return c; }
const C = { green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b", red: "#ef4444", grey: "#8b94a7", purple: "#a855f7" };
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

const PAGES = {
  async overview() {
    const s = await api(`/stats?window=${window_}`);
    main.innerHTML = `
      <div class="head"><h1>Overview</h1>${windowSeg()}</div>
      <div class="kpis">
        ${kpi("Users", fmt(s.users.total), `+${fmt(s.users.new)} new · ${fmt(s.users.active)} active`)}
        ${kpi("Paying users", fmt(s.users.byTier.pro + s.users.byTier.max), `${s.users.byTier.pro} Pro · ${s.users.byTier.max} Max`)}
        ${kpi("MRR", usd(s.revenue.mrrUsd), "subscriptions, monthly")}
        ${kpi("Commission earned", uzsK(s.revenue.commissionUzs), `on ${fmt(s.deals.accepted)} accepted deals`)}
        ${kpi("GMV", uzsK(s.deals.gmv), "value of accepted deals")}
        ${kpi("Deals", fmt(s.deals.total), `${s.deals.open} open · ${s.deals.declined} declined`)}
        ${kpi("Contact unlocks", fmt(s.unlocks), "in window")}
        ${kpi("AI calls", fmt(s.ai.total), `${s.ai.parse} parse · ${s.ai.assistant} assistant · ${s.ai.transcribe} voice · ${s.ai.verify} verify`)}
        ${kpi("Sellers", fmt(s.sellers.total), `${fmt(s.sellers.listings)} listings · ${s.sellers.suspended} suspended`)}
      </div>
      <div class="grid2">
        <div class="card"><h3>Revenue per day (UZS commission)</h3><canvas id="cRev"></canvas></div>
        <div class="card"><h3>Deals & signups per day</h3><canvas id="cAct"></canvas></div>
        <div class="card"><h3>Searches & AI calls per day</h3><canvas id="cAi"></canvas></div>
        <div class="card"><h3>Users by plan</h3><canvas id="cTier"></canvas></div>
      </div>
      <div class="card" id="aiCard"><div class="head" style="margin-bottom:8px"><h3 style="margin:0">AI (Gemini) status</h3><button class="btn sm" id="aiTest">Run self-test</button></div><div id="aiBody" class="muted">Loading…</div></div>`;
    bindWindow(main, () => go("overview"));
    const renderAi = (a, test) => {
      const rows = a.models.map((m) => `<tr><td>${esc(m.model)}</td><td class="tiny">${esc(typeof m.thinking === "string" ? m.thinking : JSON.stringify(m.thinking))}</td><td>${m.coolingDown ? `<span class="pill bad">${m.status || ""} ${esc(m.reason)}</span>` : '<span class="pill ok">ready</span>'}</td></tr>`).join("");
      const last = Object.entries(a.lastSuccess || {}).map(([k, v]) => `${k}: ${esc(v.model)} (${v.ms} ms, ${ago(v.at)})`).join(" · ") || "no successful calls yet since restart";
      $("#aiBody").innerHTML = `<p class="tiny" style="margin:0 0 8px">Key ${a.keyConfigured ? "configured" : "<b>MISSING</b>"} · provider ${esc(a.provider || "none")} · last success — ${last}</p>
        ${test ? `<p style="margin:0 0 8px">${test.ok ? "✅" : "❌"} self-test "${esc(test.text)}" → <b>${esc(test.parsed.product || "—")}</b> ${test.parsed.quantity ? `× ${test.parsed.quantity} ${esc(test.parsed.unit || "")}` : ""} ${test.parsed.region ? `· ${esc(test.parsed.region)}` : ""} <span class="tiny">(${test.model || "keyword fallback"}, ${test.ms} ms)</span></p>` : ""}
        <table><thead><tr><th>Model</th><th>Thinking</th><th>State</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="tiny" style="margin:8px 0 0">Free tier = ~20 requests per model per day; a model on cooldown is skipped and the next one answers. Enable billing on the Google AI Studio project to lift the limit.</p>`;
    };
    api("/ai").then((a) => renderAi(a)).catch((e) => { $("#aiBody").textContent = e.message; });
    $("#aiTest").addEventListener("click", async () => { $("#aiTest").disabled = true; try { const t = await api("/ai/selftest", { method: "POST", body: "{}" }); const a = await api("/ai"); renderAi(a, t); } finally { $("#aiTest").disabled = false; } });
    const labels = s.series.map((d) => d.day.slice(5));
    lineChart($("#cRev"), labels, [{ label: "Commission", data: s.series.map((d) => d.commission), borderColor: C.green, backgroundColor: rgba(C.green, .15) }]);
    lineChart($("#cAct"), labels, [{ label: "Accepted deals", data: s.series.map((d) => d.deals), borderColor: C.blue, backgroundColor: rgba(C.blue, .12) }, { label: "Signups", data: s.series.map((d) => d.signups), borderColor: C.amber, backgroundColor: rgba(C.amber, .12) }]);
    lineChart($("#cAi"), labels, [{ label: "Searches", data: s.series.map((d) => d.searches), borderColor: C.purple, backgroundColor: rgba(C.purple, .12) }, { label: "AI calls", data: s.series.map((d) => d.ai), borderColor: C.green, backgroundColor: rgba(C.green, .12) }]);
    doughnut($("#cTier"), ["Free", "Pro", "Max"], [s.users.byTier.free, s.users.byTier.pro, s.users.byTier.max], [C.grey, C.blue, C.amber]);
  },

  async users() {
    let q = "", tier = "", pg = 1;
    const render = async () => {
      const d = await api(`/users?q=${encodeURIComponent(q)}&tier=${tier}&page=${pg}`);
      $("#tbl").innerHTML = `<table><thead><tr><th>User</th><th>Telegram ID</th><th>Plan</th><th class="num">Unlocks</th><th class="num">Deals</th><th class="num">GMV</th><th>Last seen</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
        ${d.users.map((u) => `<tr data-id="${u.id}">
          <td><span class="avatar">${esc((u.name || "?")[0].toUpperCase())}</span>${esc(u.name || "—")}${u.username ? ` <span class="tiny">@${esc(u.username)}</span>` : ""}${u.verifiedBuyer ? " ✅" : ""}${u.banned ? ' <span class="pill bad">banned</span>' : ""}</td>
          <td class="tiny">${esc(u.telegramUserId)}</td>
          <td><select class="sel" data-act="tier" style="min-width:90px;padding:4px 8px">${["free", "pro", "max"].map((t) => `<option ${t === u.tier ? "selected" : ""}>${t}</option>`).join("")}</select></td>
          <td class="num">${u.unlocks}</td><td class="num">${u.deals}</td><td class="num">${uzs(u.gmv)}</td>
          <td class="tiny">${ago(u.lastSeenAt)}</td><td class="tiny">${new Date(u.createdAt).toLocaleDateString()}</td>
          <td><button class="btn sm ${u.verifiedBuyer ? "" : "ok"}" data-act="verify">${u.verifiedBuyer ? "Unverify" : "Verify"}</button> <button class="btn sm ${u.banned ? "ok" : "danger"}" data-act="ban">${u.banned ? "Unban" : "Ban"}</button></td>
        </tr>`).join("") || `<tr><td colspan="9" class="muted">No users yet — open the Mini App or message the bot to create one.</td></tr>`}
      </tbody></table>
      <div class="pager">${fmt(d.total)} users · page ${d.page}/${Math.max(1, Math.ceil(d.total / d.pageSize))} <button class="btn sm" data-pg="-1" ${d.page <= 1 ? "disabled" : ""}>‹</button><button class="btn sm" data-pg="1" ${d.page * d.pageSize >= d.total ? "disabled" : ""}>›</button></div>`;
      $("#tbl").querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { pg += Number(b.dataset.pg); render(); }));
      $("#tbl").querySelectorAll("[data-act]").forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "click", async () => {
        const id = el.closest("tr").dataset.id; const u = d.users.find((x) => String(x.id) === id);
        const patch = el.dataset.act === "tier" ? { tier: el.value } : el.dataset.act === "ban" ? { banned: !u.banned } : { verifiedBuyer: !u.verifiedBuyer };
        if (patch.banned && !confirm(`Ban ${u.name || u.telegramUserId}? They will get 403 on every request.`)) return render();
        await api(`/users/${id}`, { method: "POST", body: JSON.stringify(patch) }); toast("Saved"); render();
      }));
    };
    main.innerHTML = `<div class="head"><h1>Users</h1></div><div class="toolbar"><input class="search" id="q" placeholder="Search name, @username, Telegram ID" /><select class="sel" id="tier"><option value="">All plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="max">Max</option></select></div><div id="tbl"></div>`;
    $("#q").addEventListener("input", (e) => { q = e.target.value; pg = 1; render(); }); $("#tier").addEventListener("change", (e) => { tier = e.target.value; pg = 1; render(); });
    await render();
  },

  async sellers() {
    let q = "", province = "", susp = "", pg = 1;
    const meta = await api("/products");
    const render = async () => {
      const d = await api(`/sellers?q=${encodeURIComponent(q)}&province=${province}&suspended=${susp}&page=${pg}`);
      $("#tbl").innerHTML = `<table><thead><tr><th>Seller</th><th>Bazaar</th><th>Province</th><th class="num">Rating</th><th>Reliability</th><th class="num">Listings</th><th class="num">Deals</th><th class="num">Revenue</th><th>Actions</th></tr></thead><tbody>
        ${d.sellers.map((s) => `<tr data-id="${s.id}">
          <td>${esc(s.name)}${s.verified ? " ✅" : ""}${s.suspended ? ' <span class="pill bad">suspended</span>' : ""}</td><td>${esc(s.bazaar)}</td><td>${esc(s.province || s.region)}</td>
          <td class="num">${s.rating.toFixed(1)}</td><td><span class="pill ${s.reliability}">${s.reliability} ${s.score}</span></td>
          <td class="num">${s.listings}</td><td class="num">${s.deals}</td><td class="num">${uzs(s.revenue)}</td>
          <td><button class="btn sm ${s.verified ? "" : "ok"}" data-act="verify">${s.verified ? "Unverify" : "Verify"}</button> <button class="btn sm ${s.suspended ? "ok" : "danger"}" data-act="suspend">${s.suspended ? "Restore" : "Suspend"}</button></td>
        </tr>`).join("")}
      </tbody></table>
      <div class="pager">${fmt(d.total)} sellers · page ${d.page}/${Math.max(1, Math.ceil(d.total / d.pageSize))} <button class="btn sm" data-pg="-1" ${d.page <= 1 ? "disabled" : ""}>‹</button><button class="btn sm" data-pg="1" ${d.page * d.pageSize >= d.total ? "disabled" : ""}>›</button></div>`;
      $("#tbl").querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { pg += Number(b.dataset.pg); render(); }));
      $("#tbl").querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", async () => {
        const id = el.closest("tr").dataset.id; const s = d.sellers.find((x) => String(x.id) === id);
        const patch = el.dataset.act === "suspend" ? { suspended: !s.suspended } : { verified: !s.verified };
        await api(`/sellers/${id}`, { method: "POST", body: JSON.stringify(patch) }); toast(patch.suspended ? "Seller hidden from search, feed and lists" : "Saved"); render();
      }));
    };
    main.innerHTML = `<div class="head"><h1>Sellers</h1></div><div class="toolbar"><input class="search" id="q" placeholder="Search seller or bazaar" /><select class="sel" id="prov"><option value="">All provinces</option>${meta.provinces.map((p) => `<option value="${p.key}">${esc(p.label)}</option>`).join("")}</select><select class="sel" id="susp"><option value="">All</option><option value="0">Active</option><option value="1">Suspended</option></select></div><div id="tbl"></div>`;
    $("#q").addEventListener("input", (e) => { q = e.target.value; pg = 1; render(); }); $("#prov").addEventListener("change", (e) => { province = e.target.value; pg = 1; render(); }); $("#susp").addEventListener("change", (e) => { susp = e.target.value; pg = 1; render(); });
    await render();
  },

  async listings() {
    let q = "", product = "", pg = 1;
    const meta = await api("/products");
    const render = async () => {
      const d = await api(`/listings?q=${encodeURIComponent(q)}&product=${product}&page=${pg}`);
      $("#tbl").innerHTML = `<table><thead><tr><th>Product</th><th>Seller</th><th class="num">Price / kg</th><th class="num">Min order</th><th>Reported</th><th>Actions</th></tr></thead><tbody>
        ${d.listings.map((l) => `<tr data-id="${l.id}"><td>${l.photoUrl ? `<img class="thumb" src="${esc(l.photoUrl)}" loading="lazy" />` : ""}${esc(l.label)}</td><td>${esc(l.seller.name)} <span class="tiny">${esc(l.seller.bazaar)}</span>${l.seller.suspended ? ' <span class="pill bad">seller suspended</span>' : ""}</td><td class="num">${fmt(l.pricePerKg)}</td><td class="num">${l.minOrderKg} kg</td><td class="tiny">${ago(l.reportedAt)}</td><td><button class="btn sm danger" data-act="del">Delete</button></td></tr>`).join("")}
      </tbody></table>
      <div class="pager">${fmt(d.total)} listings · page ${d.page}/${Math.max(1, Math.ceil(d.total / d.pageSize))} <button class="btn sm" data-pg="-1" ${d.page <= 1 ? "disabled" : ""}>‹</button><button class="btn sm" data-pg="1" ${d.page * d.pageSize >= d.total ? "disabled" : ""}>›</button></div>`;
      $("#tbl").querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { pg += Number(b.dataset.pg); render(); }));
      $("#tbl").querySelectorAll("[data-act=del]").forEach((el) => el.addEventListener("click", async () => { const id = el.closest("tr").dataset.id; if (!confirm("Delete this listing (and its deals)?")) return; await api(`/listings/${id}`, { method: "DELETE" }); toast("Deleted"); render(); }));
    };
    main.innerHTML = `<div class="head"><h1>Listings</h1></div><div class="toolbar"><input class="search" id="q" placeholder="Search product or seller" /><select class="sel" id="prod"><option value="">All products</option>${meta.products.map((p) => `<option value="${p.key}">${esc(p.label)}</option>`).join("")}</select></div><div id="tbl"></div>`;
    $("#q").addEventListener("input", (e) => { q = e.target.value; pg = 1; render(); }); $("#prod").addEventListener("change", (e) => { product = e.target.value; pg = 1; render(); });
    await render();
  },

  async deals() {
    let status = "", pg = 1;
    const render = async () => {
      const d = await api(`/deals?status=${status}&page=${pg}`);
      $("#tbl").innerHTML = `<table><thead><tr><th>#</th><th>Status</th><th>Product</th><th>Buyer</th><th>Seller</th><th class="num">Qty</th><th class="num">Offer</th><th class="num">Counter</th><th class="num">Agreed</th><th class="num">Total</th><th class="num">Commission</th><th>Updated</th></tr></thead><tbody>
        ${d.deals.map((x) => `<tr><td class="tiny">${x.id.slice(0, 8)}</td><td><span class="pill ${x.status}">${x.status}</span></td><td>${esc(x.label)}</td><td>${esc(x.buyer?.name || x.buyer?.telegramUserId || "—")} <span class="pill ${x.buyer?.tier}">${x.buyer?.tier || ""}</span></td><td>${esc(x.seller?.name)}</td><td class="num">${x.quantity} kg</td><td class="num">${fmt(x.initialOffer)}</td><td class="num">${x.counterOffer ? fmt(x.counterOffer) : "—"}</td><td class="num">${x.agreedPrice ? fmt(x.agreedPrice) : "—"}</td><td class="num">${x.totalValue ? uzs(x.totalValue) : "—"}</td><td class="num">${x.commission ? `${uzs(x.commission.total)} <span class="tiny">(${x.commission.rate * 100}%)</span>` : "—"}</td><td class="tiny">${ago(x.updatedAt)}</td></tr>`).join("")}
      </tbody></table>
      <div class="pager">${fmt(d.total)} deals · page ${d.page}/${Math.max(1, Math.ceil(d.total / d.pageSize))} <button class="btn sm" data-pg="-1" ${d.page <= 1 ? "disabled" : ""}>‹</button><button class="btn sm" data-pg="1" ${d.page * d.pageSize >= d.total ? "disabled" : ""}>›</button></div>`;
      $("#tbl").querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { pg += Number(b.dataset.pg); render(); }));
    };
    main.innerHTML = `<div class="head"><h1>Deals</h1></div><div class="toolbar"><select class="sel" id="st"><option value="">All statuses</option><option value="offered">Offered</option><option value="countered">Countered</option><option value="accepted">Accepted</option><option value="declined">Declined</option></select></div><div id="tbl"></div>`;
    $("#st").addEventListener("change", (e) => { status = e.target.value; pg = 1; render(); });
    await render();
  },

  async revenue() {
    const [s, st] = await Promise.all([api(`/stats?window=${window_}`), api("/settings")]);
    const t = st.settings.tiers;
    main.innerHTML = `
      <div class="head"><h1>Revenue</h1>${windowSeg()}</div>
      <div class="kpis">
        ${kpi("Commission (window)", uzsK(s.revenue.commissionUzs), `${s.deals.accepted} accepted deals · GMV ${uzs(s.deals.gmv)}`)}
        ${kpi("Take rate", s.deals.gmv ? `${((s.revenue.commissionUzs / s.deals.gmv) * 100).toFixed(2)}%` : "—", "commission ÷ GMV")}
        ${kpi("MRR", usd(s.revenue.mrrUsd), `${s.revenue.subscriptions.pro} × Pro ${usd(t.pro.priceUsd)} + ${s.revenue.subscriptions.max} × Max ${usd(t.max.priceUsd)}`)}
        ${kpi("ARR (run-rate)", usd(s.revenue.mrrUsd * 12), "MRR × 12")}
        ${kpi("Conversion", s.users.total ? `${(((s.users.byTier.pro + s.users.byTier.max) / s.users.total) * 100).toFixed(1)}%` : "—", "paying ÷ all users")}
        ${kpi("Avg deal", s.deals.accepted ? uzsK(s.deals.gmv / s.deals.accepted) : "—", "GMV ÷ accepted deals")}
      </div>
      <div class="grid2">
        <div class="card"><h3>Commission per day</h3><canvas id="cRev"></canvas></div>
        <div class="card"><h3>GMV per day</h3><canvas id="cGmv"></canvas></div>
      </div>
      <div class="card"><h3>Commission brackets (split 50/50 buyer & seller)</h3><table><thead><tr><th>Deal value</th><th class="num">Rate</th></tr></thead><tbody><tr><td>&lt; 1,000,000 UZS</td><td class="num">1%</td></tr><tr><td>1M – 10M</td><td class="num">3%</td></tr><tr><td>≥ 10M</td><td class="num">5%</td></tr></tbody></table><p class="tiny">Commission ${st.settings.commissionEnabled ? "is enabled" : "is DISABLED"} — change it under Settings.</p></div>`;
    bindWindow(main, () => go("revenue"));
    const labels = s.series.map((d) => d.day.slice(5));
    lineChart($("#cRev"), labels, [{ label: "Commission (UZS)", data: s.series.map((d) => d.commission), borderColor: C.green, backgroundColor: rgba(C.green, .15) }]);
    lineChart($("#cGmv"), labels, [{ label: "GMV (UZS)", data: s.series.map((d) => d.gmv), borderColor: C.blue, backgroundColor: rgba(C.blue, .12) }]);
  },

  async activity() {
    let type = "";
    const render = async () => {
      const d = await api(`/events?type=${type}&limit=200`);
      $("#list").innerHTML = d.events.map((e) => `<div class="ev"><span class="t">${new Date(e.createdAt).toLocaleString()}</span><span class="ty">${esc(e.type)}</span><span>${esc(e.buyer?.name || (e.buyer ? e.buyer.telegramUserId : ""))}</span><span class="m">${esc(e.meta ? JSON.stringify(e.meta) : "")}</span></div>`).join("") || `<p class="muted">No events yet. Events are logged as people search, use the assistant, unlock contacts and make deals.</p>`;
    };
    main.innerHTML = `<div class="head"><h1>Activity log</h1><button class="btn" id="refresh">Refresh</button></div><div class="toolbar"><select class="sel" id="ty"><option value="">All events</option>${["search", "parse", "assistant", "transcribe", "verify", "unlock", "upgrade", "deal_created", "deal_countered", "deal_accepted", "deal_declined"].map((t) => `<option>${t}</option>`).join("")}</select></div><div class="card" id="list"></div>`;
    $("#ty").addEventListener("change", (e) => { type = e.target.value; render(); }); $("#refresh").addEventListener("click", render);
    await render();
  },

  async settings() {
    const d = await api("/settings"); const s = d.settings;
    const feat = (k, label, hint) => `<div class="row"><label class="switch"><input type="checkbox" data-f="${k}" ${s.features[k] ? "checked" : ""}/> ${label}</label><span class="tiny">${hint}</span></div>`;
    main.innerHTML = `
      <div class="head"><h1>Settings</h1><button class="btn primary" id="save">Save changes</button></div>
      <div class="grid2">
        <div class="card"><h3>Subscription plans</h3><div class="form">
          ${["free", "pro", "max"].map((t) => `<div class="row"><b>${t.toUpperCase()}</b><div style="display:flex;gap:8px"><input data-t="${t}" data-k="quota" type="number" min="0" value="${s.tiers[t].quota}" title="contact unlocks per 24h"/><input data-t="${t}" data-k="priceUsd" type="number" min="0" step="0.5" value="${s.tiers[t].priceUsd}" title="price in USD / month"/></div></div>`).join("")}
          <p class="tiny">Left: contact unlocks per rolling 24 h. Right: monthly price in USD. Changes apply on the next request (5 s cache).</p>
        </div></div>
        <div class="card"><h3>Feature flags</h3><div class="form">
          ${feat("assistant", "Voice assistant", "long-press + in the Mini App")}
          ${feat("voice", "Voice input (Gemini transcription)", "mic buttons")}
          ${feat("deals", "Make-a-deal negotiation", "offers, counters, commission")}
          ${feat("verification", "AI listing verification", "photo/name/price check before posting")}
          ${feat("demoSellerActions", "Demo seller auto-replies", "sellers answer offers automatically (hackathon demo)")}
          <div class="row"><label class="switch"><input type="checkbox" id="comm" ${s.commissionEnabled ? "checked" : ""}/> Commission on deals</label><span class="tiny">1–5 % by bracket, split 50/50</span></div>
        </div></div>
      </div>
      <div class="card" style="margin-bottom:14px"><h3>Platform fees (UZS, shown to buyers before they act)</h3><div class="form">
        <div class="row"><b>Deal opening fee</b><input id="feeDeal" type="number" min="0" step="500" value="${s.fees.dealOpenUzs}" /></div>
        <div class="row"><b>Contact reveal fee</b><input id="feeContact" type="number" min="0" step="500" value="${s.fees.contactUzs}" /></div>
      </div></div>
      <div class="card"><h3>Announcement banner (shown at the top of the Mini App)</h3><div class="form"><textarea id="ann" rows="2" placeholder="Empty = no banner">${esc(s.announcement || "")}</textarea></div></div>`;
    $("#save").addEventListener("click", async () => {
      const tiers = {}; main.querySelectorAll("[data-t]").forEach((i) => { tiers[i.dataset.t] ??= {}; tiers[i.dataset.t][i.dataset.k] = Number(i.value); });
      const features = {}; main.querySelectorAll("[data-f]").forEach((i) => { features[i.dataset.f] = i.checked; });
      await api("/settings", { method: "POST", body: JSON.stringify({ tiers, features, commissionEnabled: $("#comm").checked, announcement: $("#ann").value.trim(), fees: { dealOpenUzs: Number($("#feeDeal").value) || 0, contactUzs: Number($("#feeContact").value) || 0 } }) });
      toast("Settings saved");
    });
  },
};

window.addEventListener("hashchange", () => { const p = location.hash.slice(1); if (key && p && p !== page) go(p); });
if (key) boot(); else showLogin();
