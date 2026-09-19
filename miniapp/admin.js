/* Bazaar admin dashboard — reads /admin/overview. Plain JS, same design tokens as the Mini App. */
(() => {
  const API = (new URLSearchParams(location.search).get("api") || (location.protocol.startsWith("http") ? location.origin : "http://localhost:3000")).replace(/\/$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const tierLabel = { gold: "Gold", silver: "Silver", bronze: "Bronze", new: "New" };
  let province = new URLSearchParams(location.search).get("province") || "toshkent-shahri";
  let meta = null;

  async function load() {
    const view = document.getElementById("view");
    view.innerHTML = '<div class="spinner"></div>';
    try {
      if (!meta) meta = await (await fetch(API + "/meta")).json();
      const d = await (await fetch(`${API}/admin/overview?province=${encodeURIComponent(province)}`)).json();
      renderProvinces();
      view.innerHTML = [anomalies(d), trends(d), reliability(d), personalization(d)].join("");
    } catch (e) {
      view.innerHTML = `<div class="card">Can't reach the backend at ${esc(API)}.</div>`;
    }
  }
  const plabel = (k) => { const p = meta && meta.products.find((x) => x.key === k); return p ? p.label.en : k; };
  const provLabel = (k) => { const p = meta && meta.provinces.find((x) => x.key === k); return p ? p.label.en : k; };

  function renderProvinces() {
    document.getElementById("provinces").innerHTML = meta.provinces.map((p) => `<button class="chip sm ${p.key === province ? "on" : ""}" data-p="${p.key}">${esc(p.label.en)}</button>`).join("");
  }

  function anomalies(d) {
    const items = d.anomalies.items;
    return `<div class="card"><h2>⚠️ Price anomalies <span class="pill-alert ${items.length ? "" : "ok"}">${items.length}</span></h2><p class="method">${esc(d.anomalies.method)} · all regions</p>
      ${items.length ? `<table><tr><th>Seller</th><th>Product</th><th class="n">Price</th><th class="n">Group mean</th><th class="n">z</th></tr>
      ${items.map((a) => `<tr><td><b>${esc(a.listing.sellerName)}</b><div class="sub">${esc(a.listing.bazaar)} · ${esc(provLabel(a.listing.region))}</div></td><td>${esc(plabel(a.listing.product))}</td><td class="n"><b>${fmt(a.listing.pricePerKg)}</b></td><td class="n">${fmt(a.mean)} ± ${fmt(a.stdDev)}<div class="sub">n=${a.groupSize}</div></td><td class="n z">${a.zScore}</td></tr>`).join("")}</table>` : `<p class="sub">No outliers right now.</p>`}</div>`;
  }

  function trends(d) {
    const arrow = (t) => (t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→");
    const color = (t) => (t.direction === "up" ? "var(--alert)" : t.direction === "down" ? "var(--positive)" : "var(--muted)");
    return `<div class="card"><h2>📈 30-day price trends · ${esc(provLabel(d.province))}</h2><p class="method">${esc(d.trends.method)} · seeded history until sellers report daily</p>
      <table><tr><th>Product</th><th>Direction</th><th class="n">Change</th><th class="n">Start → now</th></tr>
      ${d.trends.items.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).map((t) => `<tr><td><b>${esc(plabel(t.product))}</b></td><td style="color:${color(t)};font-weight:800">${arrow(t)} ${t.direction}</td><td class="n" style="color:${color(t)};font-weight:800">${t.changePercent > 0 ? "+" : ""}${t.changePercent}%</td><td class="n sub">${fmt(t.startPrice)} → ${fmt(t.endPrice)}</td></tr>`).join("")}</table></div>`;
  }

  function reliability(d) {
    return `<div class="card"><h2>🏅 Seller reliability</h2><p class="method">0.4·recency + 0.3·frequency + 0.3·change-ratio over 30 days · gate: score ≥ ${d.gate.minReliability} and last report ≤ ${d.gate.staleAfterHours}h</p>
      <table><tr><th>Seller</th><th>Tier</th><th class="n">Score</th><th class="n">Rec / Freq / Chg</th><th class="n">Last report</th></tr>
      ${d.reliability.map((r) => `<tr><td><b>${esc(r.name)}</b><div class="sub">${esc(provLabel(r.province))}</div></td><td><span class="tier ${r.tier}" style="padding:4px 10px;font-size:12px">${tierLabel[r.tier]}</span></td><td class="n"><b>${r.score}</b></td><td class="n sub">${r.recencyScore} / ${r.frequencyScore} / ${Math.round(r.changeRatio * 100)}%</td><td class="n sub">${r.lastReportAt ? Math.round((Date.now() - new Date(r.lastReportAt)) / 36e5) + "h ago" : "never"}</td></tr>`).join("")}</table></div>`;
  }

  function personalization(d) {
    const names = { "demo-cheap": "Buyer who always picks the cheapest", "demo-quality": "Buyer who always picks the best-rated", anon: "No history (default weights)" };
    return `<div class="card"><h2>🧭 Personalised ranking · ${esc(plabel(d.personalization.product))}</h2><p class="method">${esc(d.personalization.method)} · seeded interaction history</p>
      ${d.personalization.items.map((p) => `<div style="padding:10px 0;border-top:1px solid var(--border)"><b>${esc(names[p.buyer] || p.buyer)}</b>
        <div class="sub">preference: <b>${p.preference || "none"}</b> · weights ${p.weights ? `${Math.round(p.weights.price * 100)} / ${Math.round(p.weights.quality * 100)} / ${Math.round(p.weights.distance * 100)}` : "45 / 35 / 20"}</div>
        <ol class="toplist">${p.top.map((t) => `<li><b>${esc(t.sellerName)}</b> <span class="sub">score ${t.score} · ${fmt(t.pricePerKg)} so'm/kg · ★${t.rating}</span></li>`).join("")}</ol></div>`).join("")}</div>`;
  }

  document.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { province = b.dataset.p; history.replaceState(null, "", `?province=${province}`); load(); } });
  load();
})();
