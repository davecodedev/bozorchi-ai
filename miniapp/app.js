/* Bazarcha Mini App — plain JS, no build step. Talks to the backend's /recommend, /sellers, /meta. */
(() => {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp;
  const params = new URLSearchParams(location.search);
  const API = (params.get("api") || (location.protocol.startsWith("http") ? location.origin : "http://localhost:3000")).replace(/\/$/, "");
  const BRAND = "Bazarcha";
  const DEFAULT_PROVINCE = "toshkent-shahri";

  // ---------------------------------------------------------------- i18n
  const I18N = {
    en: {
      tagline: "Find the best price near you", searchPh: "Pomidor · 500 kg", category: "Category", region: "Region",
      all: "All", bestNear: "Best sellers near you", footNote: "We compare price, quality and distance for you.",
      tabSearch: "Search", tabSaved: "Saved", tabSellers: "Sellers", tabProfile: "Profile",
      topMatches: "Top matches", formula: (p, q, d) => `Score = ${p}% price + ${q}% quality + ${d}% distance`,
      topPick: "Top pick", matchScore: "match score", viewProfile: "View seller profile", alsoMatching: "Also matching",
      price: "Price", quality: "Quality", distance: "Distance", dist: "Dist", cheapestNote: "Cheapest price — lower quality & distance score",
      noResults: "No sellers match this search yet.", tryAnother: "Try another product or region.",
      sellerProfile: "Seller profile", verifiedBy: `Verified by ${BRAND} AI`, notVerified: "Not verified yet",
      matchFor: (q, p) => `Match for ${q ? q + " kg " : ""}${p}`, priceNote: (s) => s >= 80 ? `Price competitiveness ${s}/100 — strong value for an order this size.` : s >= 50 ? `Price competitiveness ${s}/100 — fair for an order this size.` : `Price competitiveness ${s}/100 — pricier than alternatives nearby.`,
      requested: (q) => `~${q} kg requested`, currentPrices: "Current prices", minOrder: (kg) => `min. ${kg} kg`, perKg: "so'm/kg",
      viewHistory: "View 30-day price history", reviews: "Reviews", noReviews: "No public reviews yet",
      noReviewsBody: `New sellers are quality-checked by the ${BRAND} AI team before crowd reviews open, so buyers still get a trust signal from day one.`,
      requestOffer: "Request this offer", requestTitle: "Request this offer", requestBody: (n) => `We'll pass your request to ${n}. You can also reach them directly:`,
      call: "Call seller", sendRequest: "Send request", requestSent: "Request sent — the seller will contact you.",
      sellers: "Sellers", browseAll: "Browse every registered seller", searchSellers: "Search sellers by name", allSellers: "All sellers",
      saved: "Saved", savedSub: "Sellers you're keeping an eye on", savedEmpty: "Tap the bookmark icon on any seller to save them here for quick access.",
      account: "Account", myRequests: "My requests", savedSellers: "Saved sellers", notifications: "Notifications & price alerts",
      preferences: "Preferences", language: "Language", defaultRegion: "Default region", plan: "Standard plan · $15/mo", guest: "Guest",
      requestsSub: "Your past searches, ready to reorder", topMatch: (n, s) => `Top match: ${n} — ${s}`, found: (n) => `${n} matching sellers found`,
      searchAgain: "Search again", requestsEmpty: "Every search you run is saved here, so reordering a regular purchase takes one tap.",
      notifTitle: "Notifications", notifSub: "Price alerts & updates", priceAlerts: "Price alerts", alertWhen: (v) => `Alert when below ${v} so'm/kg`,
      addAlert: "Add price alert", notifSettings: "Notification settings", priceDrop: "Price drop alerts", newSellers: "New matching sellers", orderUpdates: "Order & request updates",
      product: "Product", threshold: "Alert when price is below (so'm/kg)", save: "Save", alertSaved: "Price alert saved",
      history: "Price history", today: "today", vs30: (p) => `${Math.abs(p)}% vs 30 days ago`, daysAgo30: "30 days ago", daysAgo15: "15 days ago", todayLbl: "Today",
      sample: "Sample trend for demo — becomes live once sellers report daily.",
      trendDown: "Prices are trending down", trendDownBody: "Now looks like a good time to buy compared to the last 30 days.",
      trendUp: "Prices are trending up", trendUpBody: "Consider locking in an order soon, or set an alert for a dip.",
      setAlertFor: (p) => `Set a price alert for ${p}`, chooseRegion: "Default region",
      voiceUnsupported: "Voice search isn't available here — send a voice message to the bot instead.", listening: "Listening…",
      unknownProduct: "Product not recognised. Try: pomidor, kartoshka, piyoz, bodring, olma.", offline: "Can't reach the server. Is the backend running?",
      ago: (d) => d === 0 ? "today" : d === 1 ? "yesterday" : d < 7 ? `${d} days ago` : d < 14 ? "1 week ago" : `${Math.floor(d / 7)} weeks ago`,
      catLabel: (c) => ({ vegetables: "Vegetables", fruits: "Fruits", meat: "Meat", dairy: "Dairy", durable: "Durable goods" })[c] || c,
    },
    uz: {
      tagline: "Yaqiningizdagi eng yaxshi narxni toping", searchPh: "Pomidor · 500 kg", category: "Toifa", region: "Hudud",
      all: "Barchasi", bestNear: "Yaqiningizdagi eng yaxshi sotuvchilar", footNote: "Narx, sifat va masofani siz uchun solishtiramiz.",
      tabSearch: "Qidiruv", tabSaved: "Saqlangan", tabSellers: "Sotuvchilar", tabProfile: "Profil",
      topMatches: "Eng mos takliflar", formula: (p, q, d) => `Ball = ${p}% narx + ${q}% sifat + ${d}% masofa`,
      topPick: "AI tanlovi", matchScore: "moslik bali", viewProfile: "Sotuvchi profili", alsoMatching: "Boshqa mos takliflar",
      price: "Narx", quality: "Sifat", distance: "Masofa", dist: "Masofa", cheapestNote: "Eng arzon narx — sifat va masofa bali pastroq",
      noResults: "Bu so'rov bo'yicha sotuvchi topilmadi.", tryAnother: "Boshqa mahsulot yoki hududni sinab ko'ring.",
      sellerProfile: "Sotuvchi profili", verifiedBy: `${BRAND} AI tomonidan tasdiqlangan`, notVerified: "Hali tasdiqlanmagan",
      matchFor: (q, p) => `${q ? q + " kg " : ""}${p} uchun moslik`, priceNote: (s) => s >= 80 ? `Narx raqobatbardoshligi ${s}/100 — bu hajm uchun juda foydali.` : s >= 50 ? `Narx raqobatbardoshligi ${s}/100 — bu hajm uchun o'rtacha.` : `Narx raqobatbardoshligi ${s}/100 — yaqin atrofdagilardan qimmatroq.`,
      requested: (q) => `~${q} kg so'raldi`, currentPrices: "Joriy narxlar", minOrder: (kg) => `min. ${kg} kg`, perKg: "so'm/kg",
      viewHistory: "30 kunlik narx tarixi", reviews: "Sharhlar", noReviews: "Hali ochiq sharhlar yo'q",
      noReviewsBody: `Yangi sotuvchilar sharhlar ochilishidan oldin ${BRAND} AI jamoasi tomonidan tekshiriladi — shuning uchun ishonch belgisi birinchi kundanoq mavjud.`,
      requestOffer: "Taklifni so'rash", requestTitle: "Taklifni so'rash", requestBody: (n) => `So'rovingizni ${n}ga yetkazamiz. To'g'ridan-to'g'ri bog'lanishingiz ham mumkin:`,
      call: "Qo'ng'iroq qilish", sendRequest: "So'rov yuborish", requestSent: "So'rov yuborildi — sotuvchi siz bilan bog'lanadi.",
      sellers: "Sotuvchilar", browseAll: "Barcha ro'yxatdan o'tgan sotuvchilar", searchSellers: "Sotuvchini nomi bo'yicha qidiring", allSellers: "Barcha sotuvchilar",
      saved: "Saqlangan", savedSub: "Kuzatib borayotgan sotuvchilaringiz", savedEmpty: "Sotuvchini bu yerda saqlash uchun xatcho'p belgisini bosing.",
      account: "Hisob", myRequests: "So'rovlarim", savedSellers: "Saqlangan sotuvchilar", notifications: "Bildirishnomalar va narx ogohlantirishlari",
      preferences: "Sozlamalar", language: "Til", defaultRegion: "Asosiy hudud", plan: "Standart tarif · $15/oy", guest: "Mehmon",
      requestsSub: "Oldingi qidiruvlaringiz — qayta buyurtma uchun", topMatch: (n, s) => `Eng mos: ${n} — ${s}`, found: (n) => `${n} ta mos sotuvchi topildi`,
      searchAgain: "Qayta qidirish", requestsEmpty: "Har bir qidiruvingiz shu yerda saqlanadi — doimiy xaridni bir bosishda takrorlang.",
      notifTitle: "Bildirishnomalar", notifSub: "Narx ogohlantirishlari va yangiliklar", priceAlerts: "Narx ogohlantirishlari", alertWhen: (v) => `${v} so'm/kg dan pastga tushganda`,
      addAlert: "Ogohlantirish qo'shish", notifSettings: "Bildirishnoma sozlamalari", priceDrop: "Narx tushganda", newSellers: "Yangi mos sotuvchilar", orderUpdates: "Buyurtma va so'rov yangiliklari",
      product: "Mahsulot", threshold: "Narx quyidagidan past bo'lganda (so'm/kg)", save: "Saqlash", alertSaved: "Ogohlantirish saqlandi",
      history: "Narx tarixi", today: "bugun", vs30: (p) => `30 kun oldingiga nisbatan ${Math.abs(p)}%`, daysAgo30: "30 kun oldin", daysAgo15: "15 kun oldin", todayLbl: "Bugun",
      sample: "Demo uchun namunaviy trend — sotuvchilar har kuni narx kiritganda jonli bo'ladi.",
      trendDown: "Narxlar tushmoqda", trendDownBody: "So'nggi 30 kunga nisbatan hozir xarid qilish uchun yaxshi vaqt.",
      trendUp: "Narxlar oshmoqda", trendUpBody: "Tez orada buyurtma bering yoki narx tushishi uchun ogohlantirish qo'ying.",
      setAlertFor: (p) => `${p} uchun ogohlantirish qo'yish`, chooseRegion: "Asosiy hudud",
      voiceUnsupported: "Ovozli qidiruv bu yerda ishlamaydi — botga ovozli xabar yuboring.", listening: "Tinglayapman…",
      unknownProduct: "Mahsulot tanilmadi. Masalan: pomidor, kartoshka, piyoz, bodring, olma.", offline: "Server bilan aloqa yo'q. Backend ishlayaptimi?",
      ago: (d) => d === 0 ? "bugun" : d === 1 ? "kecha" : d < 7 ? `${d} kun oldin` : d < 14 ? "1 hafta oldin" : `${Math.floor(d / 7)} hafta oldin`,
      catLabel: (c) => ({ vegetables: "Sabzavotlar", fruits: "Mevalar", meat: "Go'sht", dairy: "Sut mahsulotlari", durable: "Uzoq saqlanadigan" })[c] || c,
    },
    ru: {
      tagline: "Найдите лучшую цену рядом", searchPh: "Помидор · 500 кг", category: "Категория", region: "Регион",
      all: "Все", bestNear: "Лучшие продавцы рядом", footNote: "Мы сравниваем цену, качество и расстояние за вас.",
      tabSearch: "Поиск", tabSaved: "Избранное", tabSellers: "Продавцы", tabProfile: "Профиль",
      topMatches: "Лучшие предложения", formula: (p, q, d) => `Балл = ${p}% цена + ${q}% качество + ${d}% расстояние`,
      topPick: "Выбор AI", matchScore: "балл", viewProfile: "Профиль продавца", alsoMatching: "Также подходят",
      price: "Цена", quality: "Качество", distance: "Расстояние", dist: "Расст.", cheapestNote: "Самая низкая цена — ниже балл качества и расстояния",
      noResults: "Продавцы по этому запросу пока не найдены.", tryAnother: "Попробуйте другой товар или регион.",
      sellerProfile: "Профиль продавца", verifiedBy: `Проверен ${BRAND} AI`, notVerified: "Ещё не проверен",
      matchFor: (q, p) => `Соответствие: ${q ? q + " кг " : ""}${p}`, priceNote: (s) => s >= 80 ? `Конкурентность цены ${s}/100 — отличная для такого объёма.` : s >= 50 ? `Конкурентность цены ${s}/100 — средняя для такого объёма.` : `Конкурентность цены ${s}/100 — дороже соседних предложений.`,
      requested: (q) => `~${q} кг запрошено`, currentPrices: "Текущие цены", minOrder: (kg) => `мин. ${kg} кг`, perKg: "сум/кг",
      viewHistory: "История цен за 30 дней", reviews: "Отзывы", noReviews: "Публичных отзывов пока нет",
      noReviewsBody: `Новых продавцов проверяет команда ${BRAND} AI до открытия отзывов, поэтому сигнал доверия есть с первого дня.`,
      requestOffer: "Запросить предложение", requestTitle: "Запросить предложение", requestBody: (n) => `Мы передадим запрос продавцу ${n}. Также можно связаться напрямую:`,
      call: "Позвонить", sendRequest: "Отправить запрос", requestSent: "Запрос отправлен — продавец свяжется с вами.",
      sellers: "Продавцы", browseAll: "Все зарегистрированные продавцы", searchSellers: "Поиск продавца по имени", allSellers: "Все продавцы",
      saved: "Избранное", savedSub: "Продавцы, за которыми вы следите", savedEmpty: "Нажмите значок закладки у продавца, чтобы сохранить его здесь.",
      account: "Аккаунт", myRequests: "Мои запросы", savedSellers: "Избранные продавцы", notifications: "Уведомления и оповещения о ценах",
      preferences: "Настройки", language: "Язык", defaultRegion: "Регион по умолчанию", plan: "Стандартный тариф · $15/мес", guest: "Гость",
      requestsSub: "Прошлые запросы — для повторного заказа", topMatch: (n, s) => `Лучший: ${n} — ${s}`, found: (n) => `Найдено продавцов: ${n}`,
      searchAgain: "Искать снова", requestsEmpty: "Каждый поиск сохраняется здесь — повторный заказ в одно касание.",
      notifTitle: "Уведомления", notifSub: "Оповещения о ценах и обновления", priceAlerts: "Оповещения о ценах", alertWhen: (v) => `Когда цена ниже ${v} сум/кг`,
      addAlert: "Добавить оповещение", notifSettings: "Настройки уведомлений", priceDrop: "Снижение цены", newSellers: "Новые подходящие продавцы", orderUpdates: "Обновления заказов и запросов",
      product: "Товар", threshold: "Когда цена ниже (сум/кг)", save: "Сохранить", alertSaved: "Оповещение сохранено",
      history: "История цен", today: "сегодня", vs30: (p) => `${Math.abs(p)}% к 30 дням назад`, daysAgo30: "30 дней назад", daysAgo15: "15 дней назад", todayLbl: "Сегодня",
      sample: "Демо-тренд — станет живым, когда продавцы начнут вносить цены ежедневно.",
      trendDown: "Цены снижаются", trendDownBody: "Сейчас хорошее время для покупки по сравнению с последними 30 днями.",
      trendUp: "Цены растут", trendUpBody: "Стоит заказать в ближайшее время или поставить оповещение на снижение.",
      setAlertFor: (p) => `Оповещение о цене на ${p}`, chooseRegion: "Регион по умолчанию",
      voiceUnsupported: "Голосовой поиск здесь недоступен — отправьте голосовое боту.", listening: "Слушаю…",
      unknownProduct: "Товар не распознан. Например: помидор, картошка, лук, огурец, яблоко.", offline: "Сервер недоступен. Бэкенд запущен?",
      ago: (d) => d === 0 ? "сегодня" : d === 1 ? "вчера" : d < 7 ? `${d} дн. назад` : d < 14 ? "неделю назад" : `${Math.floor(d / 7)} нед. назад`,
      catLabel: (c) => ({ vegetables: "Овощи", fruits: "Фрукты", meat: "Мясо", dairy: "Молочные", durable: "Долгого хранения" })[c] || c,
    },
  };
  const t = (k, ...a) => { const v = I18N[S.lang][k] ?? I18N.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };

  // ---------------------------------------------------------------- icons
  const I = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10 5 4h14l1 6"/><path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6.5a2 2 0 0 1-2 1.5H7"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  };

  // ---------------------------------------------------------------- storage (localStorage + Telegram CloudStorage mirror)
  const KEY = "bazarcha:v1";
  const defaults = () => ({
    lang: null, province: DEFAULT_PROVINCE, saved: [], requests: [], alerts: [],
    notif: { priceDrop: true, newSellers: true, orderUpdates: false },
  });
  const store = { ...defaults() };
  const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
  function loadStore() {
    try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* private mode etc. */ }
    return new Promise((resolve) => {
      if (!cloud) return resolve();
      cloud.getItem(KEY, (err, val) => { if (!err && val) { try { Object.assign(store, JSON.parse(val)); } catch {} } resolve(); });
      setTimeout(resolve, 800); // don't hang the UI on a slow cloud read
    });
  }
  function save() {
    const json = JSON.stringify(store);
    try { localStorage.setItem(KEY, json); } catch {}
    if (cloud) cloud.setItem(KEY, json, () => {});
  }

  // ---------------------------------------------------------------- state
  const S = {
    lang: "en", meta: null, sellers: null, sellerCache: {},
    q: { text: "", qty: null }, category: "all", province: DEFAULT_PROVINCE, location: null,
    results: null, sellerQ: "", sellersCat: "all", sellersProv: null, loading: false, listening: false,
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US").replace(/,/g, ",");
  const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const PALETTE = ["#3E5CF6", "#2F7DE1", "#1AA6E6", "#0BB5C9", "#2D68F0"];
  const color = (s) => PALETTE[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  const avatar = (name, cls = "") => `<span class="avatar ${cls}" style="background:${color(name)}">${esc(initials(name))}</span>`;
  const plabel = (key) => { const p = S.meta && S.meta.products.find((x) => x.key === key); return p ? p.label[S.lang] || p.label.en : key; };
  const provLabel = (key) => { const p = S.meta && S.meta.provinces.find((x) => x.key === key); return p ? p.label[S.lang] || p.label.en : key || ""; };
  const isSaved = (id) => store.saved.includes(Number(id));
  const daysBetween = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const haptic = (type = "light") => { try { tg.HapticFeedback.impactOccurred(type); } catch {} };

  // ---------------------------------------------------------------- api
  async function api(path, opts) {
    const res = await fetch(API + path, { headers: { "content-type": "application/json" }, ...opts });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(body.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return body;
  }
  const loadSellers = async () => (S.sellers ??= (await api("/sellers")).sellers);
  async function loadSeller(id) {
    if (!S.sellerCache[id]) S.sellerCache[id] = (await api(`/sellers/${id}`)).seller;
    return S.sellerCache[id];
  }

  // ---------------------------------------------------------------- query parsing: "Pomidor · 500 kg" → {text, qty}
  function parseQuery(raw) {
    let text = raw.replace(/[·•]/g, " ").trim();
    let qty = null;
    const m = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|кг|t|tonna|тонн[аы]?|т)\b/i);
    if (m) {
      const n = parseFloat(m[1].replace(",", "."));
      qty = /^(t|tonna|тонн|т)/i.test(m[2]) ? n * 1000 : n;
      text = text.replace(m[0], " ").replace(/\s+/g, " ").trim();
    }
    return { text, qty };
  }

  async function runSearch(raw, opts = {}) {
    const { text, qty } = parseQuery(raw);
    if (!text) return;
    S.q = { text, qty };
    S.loading = true; render();
    try {
      const body = { product: text, quantityKg: qty || undefined, limit: 3 };
      if (S.location) { body.lat = S.location.lat; body.lng = S.location.lng; }
      else if (opts.region) body.region = opts.region;
      if (!opts.region || opts.provinceExplicit) body.province = S.province;
      const data = await api("/recommend", { method: "POST", body: JSON.stringify(body) });
      S.results = data;
      const top = data.results[0];
      store.requests.unshift({
        id: Date.now(), raw: `${qty ? qty + " kg " : ""}${plabel(data.product)}`, product: data.product, qty, province: S.province,
        top: top ? { name: top.sellerName, score: top.score } : null, count: data.candidates, at: new Date().toISOString(),
      });
      store.requests = store.requests.slice(0, 20); save();
      S.loading = false;
      go("results");
    } catch (e) {
      S.loading = false; render();
      toast(e.status === 404 ? t("unknownProduct") : e.status ? e.message : t("offline"));
    }
  }

  // ---------------------------------------------------------------- routing
  const go = (hash) => { location.hash = hash; };
  const route = () => { const h = location.hash.replace(/^#\/?/, ""); const [name, ...rest] = h.split("/"); return { name: name || "search", args: rest }; };
  const TABS = ["search", "saved", "sellers", "profile"];
  window.addEventListener("hashchange", render);

  function render() {
    const r = route();
    const view = document.getElementById("view");
    const fn = SCREENS[r.name] || SCREENS.search;
    const isTab = TABS.includes(r.name);
    view.classList.toggle("has-tabs", isTab);
    document.getElementById("tabbar").hidden = !isTab;
    if (isTab) renderTabs(r.name);
    if (tg) { if (isTab) tg.BackButton.hide(); else tg.BackButton.show(); }
    view.scrollTop = 0; window.scrollTo(0, 0);
    Promise.resolve(fn(...r.args)).then((html) => { if (route().name === r.name) view.innerHTML = html; afterRender(r.name); })
      .catch((e) => { view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  }
  function renderTabs(active) {
    const tabs = [["search", I.search, t("tabSearch")], ["saved", I.bookmark, t("tabSaved")], ["sellers", I.store, t("tabSellers")], ["profile", I.user, t("tabProfile")]];
    document.getElementById("tabbar").innerHTML = tabs.map(([k, ic, l]) => `<button class="${k === active ? "on" : ""}" data-go="${k}">${ic}<span>${l}</span></button>`).join("");
  }
  const back = () => { if (history.length > 1) history.back(); else go("search"); };
  if (tg) tg.BackButton.onClick(back);

  // ---------------------------------------------------------------- shared pieces
  const header = (title, sub, right = "") => `
    <div class="hdr"><button class="hdr-back" data-act="back" aria-label="Back">${I.back}</button>
      <div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${right ? `<div class="hdr-right">${right}</div>` : ""}</div>`;
  const brandHeader = (title, sub, icon) => `
    <div class="hdr"><div class="hdr-icon">${icon}</div><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div>`;
  const catChips = (active, dataKey) => `
    <p class="label">${t("category")}</p>
    <div class="chips">
      <button class="chip ${active === "all" ? "on" : ""}" data-${dataKey}="all">${t("all")}</button>
      ${S.meta.categories.map((c) => `<button class="chip ${active === c.key ? "on" : ""}" data-${dataKey}="${c.key}">${esc(c.label[S.lang] || c.label.en)}</button>`).join("")}
    </div>`;
  const provChips = (active, dataKey, allowAll) => `
    <p class="label">${t("region")}</p>
    <div class="chips scroll">
      ${allowAll ? `<button class="chip ${!active ? "on" : ""}" data-${dataKey}="">${t("all")}</button>` : ""}
      ${S.meta.provinces.map((p) => `<button class="chip ${active === p.key ? "on" : ""}" data-${dataKey}="${p.key}">${esc(p.label[S.lang] || p.label.en)}</button>`).join("")}
    </div>`;
  const bars = (b) => `
    <div class="bars">
      <span class="k">${t("price")}</span><div class="bar"><i style="width:${b.priceScore}%"></i></div><span class="v">${Math.round(b.priceScore)}</span>
      <span class="k">${t("quality")}</span><div class="bar q"><i style="width:${b.qualityScore}%"></i></div><span class="v">${Math.round(b.qualityScore)}</span>
      <span class="k">${t("distance")}</span><div class="bar d"><i style="width:${b.distanceScore}%"></i></div><span class="v">${Math.round(b.distanceScore)}</span>
    </div>`;
  const bmBtn = (id) => `<button class="bm ${isSaved(id) ? "on" : ""}" data-bm="${id}" aria-label="Save">${isSaved(id) ? I.bookmarkFill : I.bookmark}</button>`;
  const sellerRow = (s) => `
    <div class="card row"><button class="row grow" data-go="seller/${s.id}" style="text-align:left">${avatar(s.name)}
      <div class="grow"><div class="name">${esc(s.name)}</div><div class="sub">${esc(s.region)} · <span class="star">★ ${s.rating.toFixed(1)}</span></div></div></button>${bmBtn(s.id)}</div>`;
  const sellerCats = (s) => (s.categories || []).map((c) => t("catLabel", c)).join(" & ") || "—";
  const empty = (icon, text) => `<div class="empty">${icon}<div>${text}</div></div>`;
  const spinner = () => `<div class="spinner"></div>`;

  // ---------------------------------------------------------------- screens
  const SCREENS = {
    async search() {
      const sellers = (await loadSellers()).filter((s) => s.province === S.province && (S.category === "all" || s.categories.includes(S.category))).slice(0, 6);
      const q = S.q.text ? `${S.q.text}${S.q.qty ? ` · ${S.q.qty} kg` : ""}` : "";
      return `
        ${brandHeader(BRAND, t("tagline"), I.bag)}
        <form class="search" data-form="search">
          ${I.search.replace("<svg", '<svg class="lead"')}
          <input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="${t("searchPh")}" value="${esc(q)}" />
          <button type="button" class="icon-btn ${S.listening ? "listening" : ""}" data-act="mic" aria-label="Voice">${I.mic}</button>
          <button type="submit" class="icon-btn primary" aria-label="Search" ${S.loading ? "disabled" : ""}>${I.arrow}</button>
        </form>
        ${catChips(S.category, "cat")}
        ${provChips(S.province, "prov", false)}
        <p class="label">${t("bestNear")}</p>
        ${sellers.length ? `<div class="carousel" id="carousel">${sellers.map((s) => `
          <button class="bs-card" data-go="seller/${s.id}">
            <div class="bs-hero">${I.bag}<span class="pill">★ ${s.rating.toFixed(1)}</span></div>
            <div class="bs-foot row">${avatar(s.name)}<div class="grow" style="text-align:left"><div class="name">${esc(s.name)}</div><div class="sub">${esc(s.region)} · ${esc(sellerCats(s))}</div></div></div>
          </button>`).join("")}</div>
          <div class="dots" id="dots">${sellers.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>`
          : empty(I.store, t("noResults"))}
        <p class="foot-note">${t("footNote")}</p>
        ${S.loading ? spinner() : ""}`;
    },

    results() {
      const d = S.results;
      if (!d) { go("search"); return ""; }
      const w = S.meta.defaultWeights;
      const sub = `${S.q.qty ? S.q.qty + " kg " : ""}${plabel(d.product).toLowerCase()} · ${provLabel(S.province)}`;
      const [top, ...rest] = d.results;
      const cheapestId = d.results.length ? d.results.reduce((a, b) => (a.pricePerKg <= b.pricePerKg ? a : b)).sellerId : null;
      return `
        ${header(t("topMatches"), sub)}
        <div class="banner">${I.sliders}<span>${t("formula", Math.round(w.price * 100), Math.round(w.quality * 100), Math.round(w.distance * 100))}</span></div>
        ${!top ? `<div class="card">${empty(I.search, t("noResults") + " " + t("tryAnother"))}</div>` : `
        <div class="card soft">
          <span class="badge" style="margin-bottom:12px">${t("topPick")}</span>
          <div class="row" style="margin-bottom:14px">${avatar(top.sellerName, "md")}
            <div class="grow"><div class="name">${esc(top.sellerName)}</div><div class="sub">${esc(top.region)}</div></div>
            <div style="text-align:right"><div class="big">${Math.round(top.score)}</div><div class="sub">${t("matchScore")}</div></div></div>
          ${bars(top.breakdown)}
          <button class="btn" style="margin-top:16px" data-go="seller/${top.sellerId}">${t("viewProfile")} ${I.arrow}</button>
        </div>
        ${rest.length ? `<p class="label caps">${t("alsoMatching")}</p>` : ""}
        ${rest.map((r) => `
          <button class="card" style="width:100%;text-align:left" data-go="seller/${r.sellerId}">
            <div class="row"><span class="rank">#${r.rank}</span><div class="grow"><div class="name">${esc(r.sellerName)}</div><div class="sub">${esc(r.region)}</div></div><div class="big" style="font-size:24px">${Math.round(r.score)}</div></div>
            <div class="legend"><span><i class="dot"></i>${t("price")} <b>${Math.round(r.breakdown.priceScore)}</b></span><span><i class="dot q"></i>${t("quality")} <b>${Math.round(r.breakdown.qualityScore)}</b></span><span><i class="dot d"></i>${t("dist")} <b>${Math.round(r.breakdown.distanceScore)}</b></span></div>
            ${r.sellerId === cheapestId ? `<div class="hint">${t("cheapestNote")}</div>` : ""}
          </button>`).join("")}`}`;
    },

    async seller(id) {
      const s = await loadSeller(id);
      const match = S.results && S.results.results.find((r) => r.sellerId === s.id);
      const product = match ? S.results.product : (s.products[0] && s.products[0].product);
      const reviews = s.reviews || [];
      return `
        ${header(t("sellerProfile"), "", bmBtn(s.id))}
        <div class="card soft" style="text-align:center;padding:24px 16px">
          ${avatar(s.name, "lg")}
          <div class="name" style="font-size:20px;margin-top:12px">${esc(s.name)}</div>
          <div class="sub">${esc(s.region)}, ${esc(provLabel(s.province))}</div>
          <div style="margin-top:12px"><span class="verified ${s.verified ? "" : "off"}">${I.shield}${s.verified ? t("verifiedBy") : t("notVerified")}</span></div>
        </div>
        ${match ? `
        <div class="card">
          <div class="score-hd"><span class="t">${esc(t("matchFor", S.q.qty, plabel(product)))}</span><span class="big">${Math.round(match.score)}</span></div>
          ${bars(match.breakdown)}
          <p class="sub" style="margin:12px 0 0">${esc(t("priceNote", Math.round(match.breakdown.priceScore)))}</p>
        </div>
        <div class="chips"><span class="tag">${esc(plabel(product))}</span>${S.q.qty ? `<span class="tag">${esc(t("requested", S.q.qty))}</span>` : ""}<span class="tag">${fmt(match.pricePerKg)} ${t("perKg")}</span></div>`
        : `
        <div class="card"><p class="label caps" style="margin-bottom:12px">${t("currentPrices")}</p>
          ${s.products.length ? s.products.map((p) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--border)"><div class="grow"><b>${esc(plabel(p.product))}</b><div class="sub">${t("minOrder", p.minOrderKg)} · ${t("ago", daysBetween(p.reportedAt))}</div></div><b>${fmt(p.pricePerKg)} ${t("perKg")}</b></div>`).join("") : `<div class="sub">—</div>`}
        </div>`}
        ${product ? `<button class="link-row soft" data-go="history/${s.id}/${product}">${I.trend.replace("<svg", '<svg style="width:18px;height:18px"')}<span class="grow">${t("viewHistory")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>` : ""}
        <p class="label caps">${t("reviews")}</p>
        ${reviews.length ? reviews.map((r) => `<div class="card"><div class="row"><b>${"★".repeat(r.rating)}</b><span class="sub">${esc(r.buyer && r.buyer.name || "Buyer")} · ${t("ago", daysBetween(r.createdAt))}</span></div>${r.comment ? `<p style="margin:8px 0 0">${esc(r.comment)}</p>` : ""}</div>`).join("")
          : `<div class="card soft"><div class="row" style="align-items:flex-start">${I.shield.replace("<svg", '<svg style="width:22px;height:22px;color:var(--primary);flex:none"')}<div><div class="name">${t("noReviews")}</div><p class="sub" style="margin:4px 0 0">${t("noReviewsBody")}</p></div></div></div>`}
        <button class="btn" style="margin-top:8px" data-act="request" data-id="${s.id}">${t("requestOffer")}</button>`;
    },

    async sellers() {
      const all = await loadSellers();
      const q = S.sellerQ.trim().toLowerCase();
      const list = all.filter((s) => (!S.sellersProv || s.province === S.sellersProv) && (S.sellersCat === "all" || s.categories.includes(S.sellersCat)) && (!q || s.name.toLowerCase().includes(q)));
      return `
        ${brandHeader(t("sellers"), t("browseAll"), I.store)}
        <form class="search search-soft" data-form="sellers">${I.search.replace("<svg", '<svg class="lead"')}<input id="sq" type="search" autocomplete="off" placeholder="${t("searchSellers")}" value="${esc(S.sellerQ)}" /></form>
        ${catChips(S.sellersCat, "scat")}
        ${provChips(S.sellersProv, "sprov", true)}
        <p class="label caps">${t("allSellers")}</p>
        <div class="list">${list.length ? list.map(sellerRow).join("") : empty(I.store, t("noResults"))}</div>`;
    },

    async saved() {
      const all = await loadSellers();
      const list = store.saved.map((id) => all.find((s) => s.id === id)).filter(Boolean);
      return `
        ${brandHeader(t("saved"), t("savedSub"), I.bookmarkFill)}
        <div class="list">${list.map(sellerRow).join("")}</div>
        <p class="foot-note">${t("savedEmpty")}</p>`;
    },

    profile() {
      const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      const name = u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : t("guest");
      const sub = [u && u.username ? "@" + u.username : null, provLabel(store.province)].filter(Boolean).join(" · ");
      return `
        <div class="hdr" style="margin-top:12px">${avatar(name, "lg").replace('class="avatar', 'class="avatar').replace("lg", "lg")}<div><h1>${esc(name)}</h1><p>${esc(sub)}</p></div></div>
        <span class="plan">${t("plan")}</span>
        <p class="label caps">${t("account")}</p>
        <button class="link-row" data-go="requests"><span class="ic">${I.list}</span><span class="grow">${t("myRequests")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <button class="link-row" data-go="saved"><span class="ic">${I.bookmark}</span><span class="grow">${t("savedSellers")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <button class="link-row" data-go="notifications"><span class="ic">${I.bell}</span><span class="grow">${t("notifications")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <p class="label caps" style="margin-top:20px">${t("preferences")}</p>
        <div class="card">
          <div class="label" style="margin-bottom:0">${t("language")}</div>
          <div class="lang">${[["uz", "O'zbek"], ["ru", "Русский"], ["en", "English"]].map(([k, l]) => `<button class="chip sm ${S.lang === k ? "on" : ""}" data-lang="${k}">${l}</button>`).join("")}</div>
          <button class="row" style="width:100%;padding-top:12px;border-top:1px solid var(--border)" data-act="chooseRegion"><span class="grow muted" style="text-align:left">${t("defaultRegion")}</span><b>${esc(provLabel(store.province))}</b>${I.chev.replace("<svg", '<svg class="chev" style="margin-left:4px"')}</button>
        </div>`;
    },

    requests() {
      const list = store.requests;
      return `
        ${header(t("myRequests"), t("requestsSub"))}
        ${list.map((r, i) => `
          <div class="card ${i === 0 ? "soft" : ""}"><div class="row" style="align-items:flex-start">
            <div class="grow"><div class="name">${esc(r.raw)} · ${esc(provLabel(r.province))}</div>
              <div class="sub" style="margin-top:2px">${r.top ? esc(t("topMatch", r.top.name, Math.round(r.top.score))) : t("found", r.count)}</div>
              ${i === 0 ? `<button class="btn sm" style="margin-top:10px" data-act="again" data-i="${i}">${t("searchAgain")} ${I.arrow}</button>` : ""}</div>
            <span class="sub" style="flex:none">${t("ago", daysBetween(r.at))}</span></div>
            ${i !== 0 ? `<button data-act="again" data-i="${i}" style="position:absolute;inset:0" aria-label="${t("searchAgain")}"></button>` : ""}
          </div>`).join("")}
        <p class="foot-note">${t("requestsEmpty")}</p>`;
    },

    notifications() {
      const toggle = (on, key, sub) => `<button class="tgl ${on ? "on" : ""}" data-tgl="${key}" data-sub="${sub || ""}" role="switch" aria-checked="${on}"></button>`;
      return `
        ${header(t("notifTitle"), t("notifSub"))}
        <p class="label caps">${t("priceAlerts")}</p>
        ${store.alerts.map((a, i) => `<div class="card row" style="padding:14px 16px"><div class="grow"><div class="name">${esc(plabel(a.product))}</div><div class="sub">${esc(t("alertWhen", fmt(a.below)))}</div></div>${toggle(a.on, "alert", i)}</div>`).join("")}
        <button class="card dashed" style="width:100%" data-act="addAlert">${I.plus.replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"')}${t("addAlert")}</button>
        <p class="label caps" style="margin-top:20px">${t("notifSettings")}</p>
        <div class="settings">
          <div class="row"><span class="grow">${t("priceDrop")}</span>${toggle(store.notif.priceDrop, "notif", "priceDrop")}</div>
          <div class="row"><span class="grow">${t("newSellers")}</span>${toggle(store.notif.newSellers, "notif", "newSellers")}</div>
          <div class="row"><span class="grow">${t("orderUpdates")}</span>${toggle(store.notif.orderUpdates, "notif", "orderUpdates")}</div>
        </div>`;
    },

    async history(sellerId, product) {
      const s = await loadSeller(sellerId);
      const listing = s.products.find((p) => p.product === product) || s.products[0];
      if (!listing) return header(t("history"), "") + empty(I.trend, "—");
      const series = sampleSeries(listing.pricePerKg, `${s.id}:${listing.product}`);
      const first = series[0], last = series[series.length - 1];
      const pct = Math.round(((last - first) / first) * 100);
      const min = Math.min(...series), max = Math.max(...series);
      const W = 320, H = 150, pad = 6;
      const x = (i) => pad + (i / (series.length - 1)) * (W - pad * 2);
      const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
      const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const down = pct <= 0;
      return `
        ${header(t("history"), `${plabel(listing.product)} · ${s.bazaar}, ${provLabel(s.province)}`)}
        <div class="chart-wrap">
          <div><span class="big">${fmt(last)}</span> <span class="sub">${t("perKg")} ${t("today")}</span></div>
          <span class="trend ${down ? "down" : "up"}">${down ? I.trendDown : I.trend}${t("vs30", pct)}</span>
          <div class="axis"><span>${fmt(max)}</span><span>${t("perKg")}</span></div>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3E5CF6" stop-opacity=".25"/><stop offset="1" stop-color="#3E5CF6" stop-opacity="0"/></linearGradient></defs>
            <line x1="0" x2="${W}" y1="${pad}" y2="${pad}" stroke="#E2E4EC" stroke-dasharray="3 3"/><line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" stroke="#E2E4EC" stroke-dasharray="3 3"/>
            <polygon points="${x(0)},${H - pad} ${pts} ${x(series.length - 1)},${H - pad}" fill="url(#g)"/>
            <polyline points="${pts}" fill="none" stroke="#3E5CF6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="${x(series.length - 1)}" cy="${y(last)}" r="4" fill="#3E5CF6"/>
          </svg>
          <div class="axis"><span>${fmt(min)}</span></div>
          <div class="axis" style="margin-top:6px"><span>${t("daysAgo30")}</span><span>${t("daysAgo15")}</span><span>${t("todayLbl")}</span></div>
        </div>
        <p class="sub" style="margin:0 0 4px">${t("sample")}</p>
        <div class="callout ${down ? "good" : "bad"}">${I.thumb}<div><b>${down ? t("trendDown") : t("trendUp")}</b>${down ? t("trendDownBody") : t("trendUpBody")}</div></div>
        <button class="btn" data-act="quickAlert" data-product="${esc(listing.product)}" data-price="${last}">${esc(t("setAlertFor", plabel(listing.product)))}</button>`;
    },
  };

  /** Deterministic 30-point pseudo-random walk that ends at `endPrice`. Demo data — labelled as such in the UI. */
  function sampleSeries(endPrice, seedStr) {
    let seed = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const drift = (rnd() - 0.4) * 0.25; // slight bias toward "prices were higher"
    const pts = [1];
    for (let i = 1; i < 30; i++) pts.push(pts[i - 1] * (1 + (rnd() - 0.5) * 0.06 + drift / 30));
    const scale = endPrice / pts[pts.length - 1];
    return pts.map((p) => Math.round((p * scale) / 50) * 50);
  }

  // ---------------------------------------------------------------- sheets & toast
  function sheet(html) {
    const el = document.getElementById("sheet");
    el.innerHTML = `<div class="sheet-body">${html}</div>`; el.hidden = false;
    el.onclick = (e) => { if (e.target === el) closeSheet(); };
  }
  const closeSheet = () => { const el = document.getElementById("sheet"); el.hidden = true; el.innerHTML = ""; };
  let toastT;
  function toast(msg) {
    const el = document.getElementById("toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2600);
  }

  async function requestSheet(id) {
    const s = await loadSeller(id);
    sheet(`
      <h3>${t("requestTitle")}</h3><p class="sub">${esc(t("requestBody", s.name))}</p>
      <div class="card row" style="margin:12px 0 0">${avatar(s.name)}<div class="grow"><div class="name">${esc(s.name)}</div><div class="sub">${esc(s.phone || "")}</div></div></div>
      ${s.phone ? `<a class="btn ghost" href="tel:${esc(s.phone)}">${I.phone}${t("call")}</a>` : ""}
      <button class="btn" data-act="sendRequest" data-id="${s.id}">${t("sendRequest")}</button>`);
  }
  function regionSheet() {
    sheet(`<h3>${t("chooseRegion")}</h3>${S.meta.provinces.map((p) => `<button class="opt ${store.province === p.key ? "on" : ""}" data-setprov="${p.key}">${esc(p.label[S.lang] || p.label.en)}${store.province === p.key ? "✓" : ""}</button>`).join("")}`);
  }
  function alertSheet(product, price) {
    sheet(`
      <h3>${t("addAlert")}</h3>
      <label class="field"><span>${t("product")}</span><select id="al-p">${S.meta.products.map((p) => `<option value="${p.key}" ${p.key === product ? "selected" : ""}>${esc(p.label[S.lang] || p.label.en)}</option>`).join("")}</select></label>
      <label class="field"><span>${t("threshold")}</span><input id="al-v" type="number" inputmode="numeric" value="${price ? Math.round(price * 0.95 / 100) * 100 : ""}" placeholder="4000" /></label>
      <button class="btn" data-act="saveAlert">${t("save")}</button>`);
  }

  // ---------------------------------------------------------------- voice (Web Speech API where the WebView supports it)
  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast(t("voiceUnsupported"));
    const rec = new SR();
    rec.lang = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" }[S.lang]; rec.interimResults = false;
    S.listening = true; render(); toast(t("listening"));
    rec.onresult = (e) => { S.listening = false; const txt = e.results[0][0].transcript; runSearch(txt); };
    rec.onerror = () => { S.listening = false; render(); toast(t("voiceUnsupported")); };
    rec.onend = () => { if (S.listening) { S.listening = false; render(); } };
    try { rec.start(); } catch { S.listening = false; render(); toast(t("voiceUnsupported")); }
  }

  // ---------------------------------------------------------------- events (delegated)
  function afterRender(name) {
    if (name === "search") {
      const c = document.getElementById("carousel"), d = document.getElementById("dots");
      if (c && d) c.addEventListener("scroll", () => { const i = Math.round(c.scrollLeft / (c.firstElementChild.offsetWidth + 12)); [...d.children].forEach((el, j) => el.classList.toggle("on", j === i)); }, { passive: true });
    }
    if (name === "sellers") { const i = document.getElementById("sq"); if (i) i.oninput = () => { S.sellerQ = i.value; const list = document.querySelector(".list"); renderSellersList(list); }; }
  }
  async function renderSellersList(list) {
    const all = await loadSellers(); const q = S.sellerQ.trim().toLowerCase();
    const rows = all.filter((s) => (!S.sellersProv || s.province === S.sellersProv) && (S.sellersCat === "all" || s.categories.includes(S.sellersCat)) && (!q || s.name.toLowerCase().includes(q)));
    list.innerHTML = rows.length ? rows.map(sellerRow).join("") : empty(I.store, t("noResults"));
  }

  function submitSearch() { const v = document.getElementById("q").value; if (v.trim()) { haptic(); runSearch(v, { provinceExplicit: true }); } }
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    if (f.dataset.form === "search") submitSearch();
  });
  // Some WebViews don't fire submit for the keyboard's "search"/Enter key — handle it explicitly.
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "q") { e.preventDefault(); submitSearch(); } });
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-go],[data-act],[data-cat],[data-prov],[data-scat],[data-sprov],[data-bm],[data-lang],[data-tgl],[data-setprov]");
    if (!el) return;
    const d = el.dataset;
    if (d.go !== undefined) { haptic(); closeSheet(); return go(d.go); }
    if (d.cat) { S.category = d.cat; return render(); }
    if (d.prov !== undefined) { S.province = d.prov; S.location = null; return render(); }
    if (d.scat) { S.sellersCat = d.scat; return render(); }
    if (d.sprov !== undefined) { S.sellersProv = d.sprov || null; return render(); }
    if (d.bm) { const id = Number(d.bm); store.saved = isSaved(id) ? store.saved.filter((x) => x !== id) : [...store.saved, id]; save(); haptic("medium"); return render(); }
    if (d.lang) { S.lang = store.lang = d.lang; save(); return render(); }
    if (d.setprov) { store.province = S.province = d.setprov; save(); closeSheet(); return render(); }
    if (d.tgl) {
      if (d.tgl === "notif") store.notif[d.sub] = !store.notif[d.sub];
      else store.alerts[Number(d.sub)].on = !store.alerts[Number(d.sub)].on;
      save(); haptic(); return render();
    }
    switch (d.act) {
      case "back": return back();
      case "mic": return mic();
      case "request": haptic(); return requestSheet(d.id);
      case "sendRequest": closeSheet(); haptic("medium"); try { tg.HapticFeedback.notificationOccurred("success"); } catch {} return toast(t("requestSent"));
      case "chooseRegion": return regionSheet();
      case "addAlert": return alertSheet(S.results ? S.results.product : S.meta.products[0].key);
      case "quickAlert": return alertSheet(d.product, Number(d.price));
      case "saveAlert": {
        const p = document.getElementById("al-p").value, v = Number(document.getElementById("al-v").value);
        if (!v) return; store.alerts.unshift({ product: p, below: v, on: true }); save(); closeSheet(); toast(t("alertSaved"));
        if (route().name !== "notifications") go("notifications"); else render(); return;
      }
      case "again": { const r = store.requests[Number(d.i)]; if (!r) return; S.province = r.province || S.province; return runSearch(`${r.raw}`); }
    }
  });

  // ---------------------------------------------------------------- boot
  async function boot() {
    if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor("#F5F6FA"); tg.setBackgroundColor("#F5F6FA"); } catch {} }
    await loadStore();
    const tgLang = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code;
    S.lang = store.lang || (tgLang && tgLang.startsWith("ru") ? "ru" : tgLang && tgLang.startsWith("en") ? "en" : "uz");
    S.province = params.get("province") || store.province || DEFAULT_PROVINCE;
    document.documentElement.lang = S.lang;
    try { S.meta = await api("/meta"); } catch { document.getElementById("view").innerHTML = `<div class="empty">${I.store}<div>${esc(t("offline"))}</div><div class="sub" style="margin-top:6px">${esc(API)}</div></div>`; return; }
    // Deep link from the bot: ?product=tomato&region=Chilanzar&lat=..&lng=..
    const lat = parseFloat(params.get("lat")), lng = parseFloat(params.get("lng"));
    if (!isNaN(lat) && !isNaN(lng)) S.location = { lat, lng };
    const product = params.get("product");
    if (product) { if (!location.hash || location.hash === "#search") history.replaceState(null, "", "#search"); await runSearch(product, { region: params.get("region") || undefined }); }
    else render();
  }
  boot();
})();
