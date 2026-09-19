/* Bozorchi AI Mini App — plain JS, no build step. Talks to the backend's /recommend, /sellers, /meta. */
(() => {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp;
  const params = new URLSearchParams(location.search);
  const API = (params.get("api") || (location.protocol.startsWith("http") ? location.origin : "http://localhost:3000")).replace(/\/$/, "");
  const BRAND = "Bozorchi AI";
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
      sellerProfile: "Seller profile", verifiedBy: `Verified by ${BRAND}`, notVerified: "Not verified yet",
      matchFor: (q, p) => `Match for ${q ? q + " kg " : ""}${p}`, priceNote: (s) => s >= 80 ? `Price competitiveness ${s}/100 — strong value for an order this size.` : s >= 50 ? `Price competitiveness ${s}/100 — fair for an order this size.` : `Price competitiveness ${s}/100 — pricier than alternatives nearby.`,
      requested: (q) => `~${q} kg requested`, currentPrices: "Current prices", minOrder: (kg) => `min. ${kg} kg`, perKg: "so'm/kg",
      viewHistory: "View 30-day price history", reviews: "Reviews", noReviews: "No public reviews yet",
      noReviewsBody: `New sellers are quality-checked by the ${BRAND} team before crowd reviews open, so buyers still get a trust signal from day one.`,
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
      standard: "Standard", enterprise: "Enterprise", free: "Free", unlimited: "Unlimited", perMonth: (usd) => `$${usd}/mo`,
      searchesToday: (u, l) => `${u} of ${l} free searches today`, creditsLeft: (n) => `+${n} bought`, buyPack: (n, p) => `Buy ${n} searches · ${p} so'm`,
      upgrade: "Upgrade to Enterprise", upgradeSub: "For restaurants, retailers and wholesalers who buy every week.", payNow: (usd) => `Pay $${usd} · demo`, downgradeDemo: "Demo: switch back to Standard",
      perkUnlimited: "Unlimited searches, no daily cap", perkTop10: "Top 10 results + adjustable weights", perkForecast: "7-day price forecast with buy/wait advice", perkBasket: "Basket quotes: best single supplier vs best split", perkAlerts: "Unlimited price alerts pushed by the bot",
      upgraded: "Welcome to Enterprise!", upgradedBody: "Unlimited searches, forecasts and basket quotes are now unlocked.", packBought: (n) => `${n} searches added`,
      limitTitle: "Daily limit reached", limitBody: (l) => `Standard accounts get ${l} free searches a day. Buy a pack or go Enterprise for unlimited.`,
      lockedTag: "Enterprise", unlock: "Unlock with Enterprise", weightsTitle: "Adjust weights", apply: "Apply", showingTop: (n) => `Showing top ${n}`, moreResultsLocked: "Top 10 results and adjustable weights",
      forecastTitle: "7-day forecast", forecastLocked: "See where this price is heading next week", verdictDown: (p) => `Likely down ~${Math.abs(p)}% next week — worth waiting`, verdictUp: (p) => `Likely up ~${p}% next week — buy now`, verdictFlat: "Expected to stay flat — buy when convenient", nextWeek: "next week",
      basket: "Basket quote", basketSub: "Paste your whole order — we find the cheapest single supplier and the cheapest split, delivery included.", basketPh: "500 kg pomidor\n200 kg piyoz\n100 kg sabzi", getQuote: "Get quote",
      singleSupplier: "Best single supplier", bestSplit: "Best split", sellers: (n) => `${n} sellers`, goods: "Goods", delivery: "Delivery", total: "Total", saves: (n) => `Saves ${n} so'm`, recommendedTag: "Recommended", noSingle: "No single seller carries everything.", unknownLines: (l) => `Not recognised: ${l}`, requestQuotes: "Request these offers", quotesRequested: "Requests sent to the sellers.",
      basketLockedBody: "Order lists, not single items: one quote for the whole basket.", deliveryNote: (b, k) => `Delivery estimate: ${b} + ${k} so'm/km per seller.`,
      tierGold: "Gold reporter", tierSilver: "Silver reporter", tierBronze: "Bronze reporter", tierNew: "New seller", tierHint: "Reliability: how often and how honestly this seller reports prices (last 30 days).",
      trendLine: (p) => `Price trend: ${p > 0 ? "+" : ""}${p}% over the last 30 days`, trendMarket: "market, seeded history",
      hiddenNote: (n) => `${n} listing${n === 1 ? "" : "s"} hidden from the top results: stale or unreliable reporting.`, personalizedNote: (f) => `Ranking tuned to your habits: you tend to pick by ${f}.`,
      adminLink: "Bazaar admin dashboard",
      myProducts: "My products", addProduct: "Add a product", addProductSub: "List what you sell so buyers nearby can find you.",
      productName: "Product name", productNamePh: "e.g. Pomidor", pricePerKg: "Price (so'm/kg)", location: "Location", placePh: "Bazaar or city, e.g. Chorsu bozori",
      useMyLocation: "Use my location", locationSet: "GPS location attached", saveProduct: "Add product", fillAll: "Please fill in every field.",
      productAdded: "Product added!", productAddedBody: (n) => `${n} is now listed. Buyers searching nearby will see your offer.`, ok: "Got it", noProducts: "You haven't listed anything yet.",
      demoNote: "Demo: stored on this device for now.", perKgShort: "/kg",
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
      sellerProfile: "Sotuvchi profili", verifiedBy: `${BRAND} tomonidan tasdiqlangan`, notVerified: "Hali tasdiqlanmagan",
      matchFor: (q, p) => `${q ? q + " kg " : ""}${p} uchun moslik`, priceNote: (s) => s >= 80 ? `Narx raqobatbardoshligi ${s}/100 — bu hajm uchun juda foydali.` : s >= 50 ? `Narx raqobatbardoshligi ${s}/100 — bu hajm uchun o'rtacha.` : `Narx raqobatbardoshligi ${s}/100 — yaqin atrofdagilardan qimmatroq.`,
      requested: (q) => `~${q} kg so'raldi`, currentPrices: "Joriy narxlar", minOrder: (kg) => `min. ${kg} kg`, perKg: "so'm/kg",
      viewHistory: "30 kunlik narx tarixi", reviews: "Sharhlar", noReviews: "Hali ochiq sharhlar yo'q",
      noReviewsBody: `Yangi sotuvchilar sharhlar ochilishidan oldin ${BRAND} jamoasi tomonidan tekshiriladi — shuning uchun ishonch belgisi birinchi kundanoq mavjud.`,
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
      standard: "Standart", enterprise: "Enterprise", free: "Bepul", unlimited: "Cheksiz", perMonth: (usd) => `$${usd}/oy`,
      searchesToday: (u, l) => `Bugun ${u}/${l} bepul qidiruv`, creditsLeft: (n) => `+${n} sotib olingan`, buyPack: (n, p) => `${n} ta qidiruv olish · ${p} so'm`,
      upgrade: "Enterprise'ga o'tish", upgradeSub: "Har hafta xarid qiladigan restoran, do'kon va ulgurjichilar uchun.", payNow: (usd) => `$${usd} to'lash · demo`, downgradeDemo: "Demo: Standartga qaytish",
      perkUnlimited: "Cheksiz qidiruv, kunlik limit yo'q", perkTop10: "Top 10 natija + sozlanadigan og'irliklar", perkForecast: "7 kunlik narx prognozi va maslahat", perkBasket: "Savat bo'yicha taklif: bitta yetkazuvchi yoki bo'lib olish", perkAlerts: "Bot orqali cheksiz narx ogohlantirishlari",
      upgraded: "Enterprise'ga xush kelibsiz!", upgradedBody: "Cheksiz qidiruv, prognoz va savat takliflari ochildi.", packBought: (n) => `${n} ta qidiruv qo'shildi`,
      limitTitle: "Kunlik limit tugadi", limitBody: (l) => `Standart hisobda kuniga ${l} ta bepul qidiruv. Paket oling yoki Enterprise'ga o'ting.`,
      lockedTag: "Enterprise", unlock: "Enterprise bilan ochish", weightsTitle: "Og'irliklarni sozlash", apply: "Qo'llash", showingTop: (n) => `Top ${n} ko'rsatilmoqda`, moreResultsLocked: "Top 10 natija va sozlanadigan og'irliklar",
      forecastTitle: "7 kunlik prognoz", forecastLocked: "Kelasi hafta narx qayerga boradi — ko'ring", verdictDown: (p) => `Kelasi hafta ~${Math.abs(p)}% tushishi kutilmoqda — kutgan ma'qul`, verdictUp: (p) => `Kelasi hafta ~${p}% oshishi kutilmoqda — hozir oling`, verdictFlat: "Narx o'zgarmaydi — qulay vaqtda oling", nextWeek: "kelasi hafta",
      basket: "Savat bo'yicha taklif", basketSub: "Butun buyurtmani kiriting — eng arzon bitta yetkazuvchi va eng arzon bo'lib olishni topamiz, yetkazib berish bilan.", basketPh: "500 kg pomidor\n200 kg piyoz\n100 kg sabzi", getQuote: "Taklif olish",
      singleSupplier: "Eng yaxshi bitta yetkazuvchi", bestSplit: "Eng yaxshi bo'lib olish", sellers: (n) => `${n} ta sotuvchi`, goods: "Mahsulot", delivery: "Yetkazib berish", total: "Jami", saves: (n) => `${n} so'm tejaladi`, recommendedTag: "Tavsiya", noSingle: "Hammasini sotadigan bitta sotuvchi yo'q.", unknownLines: (l) => `Tanilmadi: ${l}`, requestQuotes: "Takliflarni so'rash", quotesRequested: "So'rovlar sotuvchilarga yuborildi.",
      basketLockedBody: "Bitta mahsulot emas — butun ro'yxat uchun bitta taklif.", deliveryNote: (b, k) => `Yetkazib berish hisobi: har sotuvchi uchun ${b} + ${k} so'm/km.`,
      tierGold: "Oltin sotuvchi", tierSilver: "Kumush sotuvchi", tierBronze: "Bronza sotuvchi", tierNew: "Yangi sotuvchi", tierHint: "Ishonchlilik: sotuvchi narxlarni qanchalik tez-tez va halol kiritadi (so'nggi 30 kun).",
      trendLine: (p) => `Narx tendensiyasi: so'nggi 30 kunda ${p > 0 ? "+" : ""}${p}%`, trendMarket: "bozor bo'yicha, demo tarix",
      hiddenNote: (n) => `${n} ta taklif eng yaxshilar ro'yxatidan yashirildi: eskirgan yoki ishonchsiz.`, personalizedNote: (f) => `Reyting odatlaringizga moslandi: siz ko'proq ${f === "price" ? "narxga" : f === "quality" ? "sifatga" : "masofaga"} qaraysiz.`,
      adminLink: "Bozor ma'muriyati paneli",
      myProducts: "Mahsulotlarim", addProduct: "Mahsulot qo'shish", addProductSub: "Nima sotayotganingizni kiriting — yaqin atrofdagi xaridorlar sizni topadi.",
      productName: "Mahsulot nomi", productNamePh: "masalan, Pomidor", pricePerKg: "Narx (so'm/kg)", location: "Joylashuv", placePh: "Bozor yoki shahar, masalan, Chorsu bozori",
      useMyLocation: "Joylashuvimni aniqlash", locationSet: "GPS joylashuv biriktirildi", saveProduct: "Qo'shish", fillAll: "Iltimos, barcha maydonlarni to'ldiring.",
      productAdded: "Mahsulot qo'shildi!", productAddedBody: (n) => `${n} ro'yxatga kiritildi. Yaqin atrofda qidirayotgan xaridorlar taklifingizni ko'radi.`, ok: "Tushunarli", noProducts: "Hali hech narsa qo'shmagansiz.",
      demoNote: "Demo: hozircha shu qurilmada saqlanadi.", perKgShort: "/kg",
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
      sellerProfile: "Профиль продавца", verifiedBy: `Проверен ${BRAND}`, notVerified: "Ещё не проверен",
      matchFor: (q, p) => `Соответствие: ${q ? q + " кг " : ""}${p}`, priceNote: (s) => s >= 80 ? `Конкурентность цены ${s}/100 — отличная для такого объёма.` : s >= 50 ? `Конкурентность цены ${s}/100 — средняя для такого объёма.` : `Конкурентность цены ${s}/100 — дороже соседних предложений.`,
      requested: (q) => `~${q} кг запрошено`, currentPrices: "Текущие цены", minOrder: (kg) => `мин. ${kg} кг`, perKg: "сум/кг",
      viewHistory: "История цен за 30 дней", reviews: "Отзывы", noReviews: "Публичных отзывов пока нет",
      noReviewsBody: `Новых продавцов проверяет команда ${BRAND} до открытия отзывов, поэтому сигнал доверия есть с первого дня.`,
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
      standard: "Стандарт", enterprise: "Enterprise", free: "Бесплатно", unlimited: "Безлимит", perMonth: (usd) => `$${usd}/мес`,
      searchesToday: (u, l) => `Сегодня ${u} из ${l} бесплатных поисков`, creditsLeft: (n) => `+${n} куплено`, buyPack: (n, p) => `Купить ${n} поисков · ${p} сум`,
      upgrade: "Перейти на Enterprise", upgradeSub: "Для ресторанов, магазинов и оптовиков, которые закупаются каждую неделю.", payNow: (usd) => `Оплатить $${usd} · демо`, downgradeDemo: "Демо: вернуться на Стандарт",
      perkUnlimited: "Безлимитный поиск без дневного лимита", perkTop10: "Топ-10 результатов + настраиваемые веса", perkForecast: "Прогноз цен на 7 дней с советом", perkBasket: "Расчёт корзины: один поставщик или разбивка", perkAlerts: "Безлимитные оповещения через бота",
      upgraded: "Добро пожаловать в Enterprise!", upgradedBody: "Безлимитный поиск, прогнозы и расчёт корзины открыты.", packBought: (n) => `Добавлено поисков: ${n}`,
      limitTitle: "Дневной лимит исчерпан", limitBody: (l) => `На Стандарте ${l} бесплатных поисков в день. Купите пакет или перейдите на Enterprise.`,
      lockedTag: "Enterprise", unlock: "Открыть с Enterprise", weightsTitle: "Настроить веса", apply: "Применить", showingTop: (n) => `Показано топ-${n}`, moreResultsLocked: "Топ-10 результатов и настраиваемые веса",
      forecastTitle: "Прогноз на 7 дней", forecastLocked: "Узнайте, куда пойдёт цена на следующей неделе", verdictDown: (p) => `Ожидается снижение ~${Math.abs(p)}% — стоит подождать`, verdictUp: (p) => `Ожидается рост ~${p}% — покупайте сейчас`, verdictFlat: "Цена не изменится — покупайте, когда удобно", nextWeek: "след. неделя",
      basket: "Расчёт корзины", basketSub: "Вставьте весь заказ — найдём самого дешёвого поставщика и самую дешёвую разбивку, с доставкой.", basketPh: "500 кг помидор\n200 кг лук\n100 кг морковь", getQuote: "Рассчитать",
      singleSupplier: "Лучший единый поставщик", bestSplit: "Лучшая разбивка", sellers: (n) => `Продавцов: ${n}`, goods: "Товар", delivery: "Доставка", total: "Итого", saves: (n) => `Экономия ${n} сум`, recommendedTag: "Рекомендуем", noSingle: "Нет продавца со всеми позициями.", unknownLines: (l) => `Не распознано: ${l}`, requestQuotes: "Запросить предложения", quotesRequested: "Запросы отправлены продавцам.",
      basketLockedBody: "Не один товар, а весь список — одним расчётом.", deliveryNote: (b, k) => `Оценка доставки: ${b} + ${k} сум/км за продавца.`,
      tierGold: "Золотой продавец", tierSilver: "Серебряный продавец", tierBronze: "Бронзовый продавец", tierNew: "Новый продавец", tierHint: "Надёжность: как часто и честно продавец сообщает цены (последние 30 дней).",
      trendLine: (p) => `Тренд цены: ${p > 0 ? "+" : ""}${p}% за 30 дней`, trendMarket: "по рынку, демо-история",
      hiddenNote: (n) => `Скрыто из топа: ${n} — устаревшие или ненадёжные.`, personalizedNote: (f) => `Рейтинг подстроен под ваши привычки: вы выбираете по ${f === "price" ? "цене" : f === "quality" ? "качеству" : "расстоянию"}.`,
      adminLink: "Панель администрации базара",
      myProducts: "Мои товары", addProduct: "Добавить товар", addProductSub: "Укажите, что продаёте, — покупатели рядом вас найдут.",
      productName: "Название товара", productNamePh: "например, Помидор", pricePerKg: "Цена (сум/кг)", location: "Локация", placePh: "Базар или город, например, Чорсу",
      useMyLocation: "Определить моё местоположение", locationSet: "GPS-локация добавлена", saveProduct: "Добавить", fillAll: "Заполните все поля.",
      productAdded: "Товар добавлен!", productAddedBody: (n) => `${n} теперь в списке. Покупатели рядом увидят ваше предложение.`, ok: "Понятно", noProducts: "Вы пока ничего не добавили.",
      demoNote: "Демо: пока хранится на этом устройстве.", perKgShort: "/кг",
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
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    basket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18l-2 10H5z"/><path d="m7 10 3-6M17 10l-3-6M9 14v3M12 14v3M15 14v3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  };

  // ---------------------------------------------------------------- storage (localStorage + Telegram CloudStorage mirror)
  const KEY = "bazarcha:v1";
  const defaults = () => ({
    lang: null, province: DEFAULT_PROVINCE, saved: [], requests: [], alerts: [], myProducts: [], guestId: null,
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
    me: null, weights: null, basketText: "", quote: null,
  };
  const isEnt = () => !!(S.me && S.me.tier === "enterprise");
  const has = (f) => !!(S.me && S.me.features && S.me.features.includes(f));
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
  function authHeaders() {
    if (tg && tg.initData) return { authorization: `tma ${tg.initData}` };
    if (!store.guestId) { store.guestId = "guest-" + Math.random().toString(36).slice(2, 10); save(); }
    return { "x-buyer-id": store.guestId };
  }
  async function api(path, opts) {
    const res = await fetch(API + path, { ...opts, headers: { "content-type": "application/json", ...authHeaders(), ...(opts && opts.headers) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(body.error || `HTTP ${res.status}`); e.status = res.status; e.body = body; throw e; }
    return body;
  }
  async function loadMe() { try { const r = await api("/me"); S.me = r.usage; S.me.buyer = r.buyer; } catch { S.me = null; } return S.me; }
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
      const body = { product: text, quantityKg: qty || undefined, limit: isEnt() ? 10 : 3 };
      if (isEnt() && S.weights) body.weights = S.weights;
      if (S.location) { body.lat = S.location.lat; body.lng = S.location.lng; }
      else if (opts.region) body.region = opts.region;
      if (!opts.region || opts.provinceExplicit) body.province = S.province;
      const data = await api("/recommend", { method: "POST", body: JSON.stringify(body) });
      S.results = data;
      if (data.usage) S.me = { ...S.me, ...data.usage };
      const top = data.results[0];
      store.requests.unshift({
        id: Date.now(), raw: `${qty ? qty + " kg " : ""}${plabel(data.product)}`, product: data.product, qty, province: S.province,
        top: top ? { name: top.sellerName, score: top.score } : null, count: data.candidates, at: new Date().toISOString(),
      });
      store.requests = store.requests.slice(0, 20); save();
      S.loading = false;
      if (route().name === "results") render(); else go("results"); // same hash → no hashchange, so render explicitly
    } catch (e) {
      S.loading = false; render();
      if (e.status === 402) { if (e.body && e.body.usage) S.me = { ...S.me, ...e.body.usage }; return limitSheet(); }
      toast(e.status === 404 ? t("unknownProduct") : e.status ? e.message : t("offline"));
    }
  }

  // ---------------------------------------------------------------- routing
  const go = (hash) => { location.hash = hash; };
  const route = () => { const h = location.hash.replace(/^#\/?/, ""); const [name, ...rest] = h.split("/"); return { name: name || "search", args: rest }; };
  const TABS = ["search", "saved", "sellers", "profile"];
  /** Which tab lights up for each sub-screen. */
  const TAB_OF = { results: "search", history: "search", seller: "sellers", requests: "profile", notifications: "profile" };
  window.addEventListener("hashchange", render);

  function render() {
    const r = route();
    const view = document.getElementById("view");
    const fn = SCREENS[r.name] || SCREENS.search;
    const isTab = TABS.includes(r.name);
    document.getElementById("tabbar").hidden = false;
    renderTabs(isTab ? r.name : TAB_OF[r.name] || "search");
    if (tg) { if (isTab) tg.BackButton.hide(); else tg.BackButton.show(); }
    Promise.resolve(fn(...r.args)).then((html) => { if (route().name === r.name) { view.innerHTML = `<div class="screen">${html}</div>`; view.scrollTop = 0; } afterRender(r.name); })
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
      <div class="grow"><div class="name">${esc(s.name)}</div><div class="sub">${esc(s.region)} · <span class="star">★ ${s.rating.toFixed(1)}</span>${s.reliability ? ` · <span class="tier-dot ${s.reliability.tier}"></span>${t({ gold: "tierGold", silver: "tierSilver", bronze: "tierBronze", new: "tierNew" }[s.reliability.tier])}` : ""}</div></div></button>${bmBtn(s.id)}</div>`;
  const sellerCats = (s) => (s.categories || []).map((c) => t("catLabel", c)).join(" & ") || "—";
  const tierBadge = (rel) => {
    if (!rel) return "";
    const k = { gold: "tierGold", silver: "tierSilver", bronze: "tierBronze", new: "tierNew" }[rel.tier] || "tierNew";
    return `<span class="tier ${rel.tier}" title="${esc(t("tierHint"))}">${I.shield}${t(k)}</span>`;
  };
  const trendLine = (tr) => tr ? `<div class="trendline ${tr.direction}">${tr.direction === "down" ? I.trendDown : I.trend}<span>${esc(t("trendLine", tr.changePercent))}</span><span class="sub">· ${t("trendMarket")}</span></div>` : "";
  const lockTag = () => `<span class="lock-tag">${I.lock}${t("lockedTag")}</span>`;
  const usagePill = () => {
    if (!S.me) return "";
    if (isEnt()) return `<div class="usage ent">${I.star}<span>${t("enterprise")} · ${t("unlimited")}</span></div>`;
    const pct = Math.min(100, (S.me.used / S.me.limit) * 100);
    return `<button class="usage" data-go="profile"><span class="meter"><i style="width:${pct}%"></i></span><span>${t("searchesToday", S.me.used, S.me.limit)}${S.me.credits ? ` · ${t("creditsLeft", S.me.credits)}` : ""}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>`;
  };
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
        ${usagePill()}
        <button class="link-row feature" data-go="basket"><span class="ic">${I.basket}</span><span class="grow"><b>${t("basket")}</b><span class="sub wrap" style="display:block">${t("basketLockedBody")}</span></span>${has("basket") ? I.chev.replace("<svg", '<svg class="chev"') : lockTag()}</button>
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
        ${has("weights") ? weightsCard(S.weights || w) : `<div class="banner">${I.sliders}<span>${t("formula", Math.round(w.price * 100), Math.round(w.quality * 100), Math.round(w.distance * 100))}</span></div>`}
        ${d.personalization && d.personalization.preference ? `<div class="banner">${I.user}<span>${esc(t("personalizedNote", d.personalization.preference))}</span></div>` : ""}
        ${!top ? `<div class="card">${empty(I.search, t("noResults") + " " + t("tryAnother"))}</div>` : `
        <div class="card soft">
          <div class="row" style="margin-bottom:12px"><span class="badge">${t("topPick")}</span>${tierBadge(top.reliability)}</div>
          <div class="row" style="margin-bottom:14px">${avatar(top.sellerName, "md")}
            <div class="grow"><div class="name">${esc(top.sellerName)}</div><div class="sub">${esc(top.region)}</div></div>
            <div style="text-align:right"><div class="big">${Math.round(top.score)}</div><div class="sub">${t("matchScore")}</div></div></div>
          <div class="price-row"><span class="price">${fmt(top.pricePerKg)} <small>${t("perKg")}</small></span><span class="sub">${top.minOrderKg ? t("minOrder", top.minOrderKg) + " · " : ""}${top.distanceKm} km</span></div>
          ${bars(top.breakdown)}
          <button class="btn" style="margin-top:16px" data-go="seller/${top.sellerId}">${t("viewProfile")} ${I.arrow}</button>
        </div>
        ${rest.length ? `<p class="label caps">${t("alsoMatching")}</p>` : ""}
        ${rest.map((r) => `
          <button class="card" style="width:100%;text-align:left" data-go="seller/${r.sellerId}">
            <div class="row"><span class="rank">#${r.rank}</span><div class="grow"><div class="name">${esc(r.sellerName)}</div><div class="sub">${esc(r.region)} · ${r.distanceKm} km</div></div>
              <div style="text-align:right;flex:none"><div class="big" style="font-size:24px">${Math.round(r.score)}</div><div class="price" style="font-size:14px">${fmt(r.pricePerKg)}<small>${t("perKgShort")}</small></div></div></div>
            <div class="legend"><span><i class="dot"></i>${t("price")} <b>${Math.round(r.breakdown.priceScore)}</b></span><span><i class="dot q"></i>${t("quality")} <b>${Math.round(r.breakdown.qualityScore)}</b></span><span><i class="dot d"></i>${t("dist")} <b>${Math.round(r.breakdown.distanceScore)}</b></span></div>
            ${r.sellerId === cheapestId ? `<div class="hint">${t("cheapestNote")}</div>` : ""}
          </button>`).join("")}
        ${d.excluded && d.excluded.length ? `<p class="sub wrap" style="margin:4px 0 12px">${I.shield.replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}${esc(t("hiddenNote", d.excluded.length))}</p>` : ""}
        ${!has("top10") ? `<button class="link-row feature" data-act="upgrade"><span class="ic">${I.lock}</span><span class="grow"><b>${t("moreResultsLocked")}</b><span class="sub wrap" style="display:block">${t("showingTop", 3)}</span></span>${lockTag()}</button>` : ""}`}`;
    },

    basket() {
      if (!has("basket")) return `
        ${header(t("basket"), "")}
        <div class="card soft" style="text-align:center;padding:28px 20px">
          <div class="mp-ic" style="margin:0 auto 12px;width:56px;height:56px">${I.basket}</div>
          <div class="name wrap" style="font-size:18px">${t("basket")}</div>
          <p class="sub wrap" style="margin:6px 0 16px">${t("basketSub")}</p>
          <div class="card" style="text-align:left;filter:blur(2px);opacity:.7;pointer-events:none">
            <div class="row"><b class="grow">${t("singleSupplier")}</b><b>7 996 800</b></div>
            <div class="row" style="margin-top:6px"><b class="grow">${t("bestSplit")}</b><b style="color:var(--positive)">7 490 400</b></div>
          </div>
          <button class="btn" data-act="upgrade">${I.lock}${t("unlock")}</button>
        </div>`;
      const q = S.quote;
      const money = (n) => fmt(n);
      const lines = (ls) => ls.map((l) => `<div class="qline"><span class="grow"><b>${esc(l.label ? l.label[S.lang] || l.label.en : l.product)}</b> <span class="sub">× ${l.quantityKg} kg</span><div class="sub">${esc(l.sellerName)} · ${fmt(l.pricePerKg)} ${t("perKgShort")}</div></span><b>${money(l.subtotal)}</b></div>`).join("");
      const totals = (o) => `<div class="qtot"><span>${t("goods")}</span><span>${money(o.goods)}</span><span>${t("delivery")}</span><span>${money(o.delivery)}</span><span class="b">${t("total")}</span><span class="b">${money(o.total)} so'm</span></div>`;
      return `
        ${header(t("basket"), t("enterprise"))}
        <p class="sub wrap" style="margin:0 0 10px">${t("basketSub")}</p>
        <textarea id="basket" class="ta" rows="4" placeholder="${t("basketPh")}">${esc(S.basketText)}</textarea>
        <button class="btn" style="margin:10px 0 18px" data-act="quote" ${S.loading ? "disabled" : ""}>${I.basket}${t("getQuote")}</button>
        ${S.loading ? spinner() : ""}
        ${q ? `
          ${q.unknown && q.unknown.length ? `<div class="banner">${I.search}<span>${esc(t("unknownLines", q.unknown.join(", ")))}</span></div>` : ""}
          ${q.unavailable && q.unavailable.length ? `<div class="banner">${I.search}<span>${esc(t("unknownLines", q.unavailable.map(plabel).join(", ")))}</span></div>` : ""}
          <div class="card ${q.recommended === "split" ? "soft" : ""}">
            <div class="row" style="margin-bottom:10px"><b class="grow">${t("bestSplit")} · ${t("sellers", q.split.sellerCount)}</b>${q.recommended === "split" ? `<span class="badge">${t("recommendedTag")}</span>` : ""}</div>
            ${lines(q.split.lines)}${totals(q.split)}
          </div>
          <div class="card ${q.recommended === "single" ? "soft" : ""}">
            <div class="row" style="margin-bottom:10px"><b class="grow">${t("singleSupplier")}</b>${q.recommended === "single" ? `<span class="badge">${t("recommendedTag")}</span>` : ""}</div>
            ${q.single ? `<div class="row" style="margin-bottom:8px">${avatar(q.single.sellerName)}<div class="grow"><div class="name">${esc(q.single.sellerName)}</div><div class="sub">${esc(q.single.bazaar)} · ${q.single.distanceKm} km ${q.single.verified ? "· ✅" : ""}</div></div></div>${lines(q.single.lines)}${totals(q.single)}` : `<p class="sub wrap" style="margin:0">${t("noSingle")}</p>`}
          </div>
          ${q.savings ? `<div class="callout good">${I.thumb}<div><b>${t("saves", fmt(q.savings))}</b>${q.recommended === "split" ? t("bestSplit") : t("singleSupplier")}</div></div>` : ""}
          <p class="sub wrap" style="margin:0 0 12px">${t("deliveryNote", fmt(q.deliveryModel.baseUzs), fmt(q.deliveryModel.perKmUzs))}</p>
          <button class="btn" data-act="requestQuotes">${t("requestQuotes")}</button>` : ""}`;
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
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><span class="verified ${s.verified ? "" : "off"}">${I.shield}${s.verified ? t("verifiedBy") : t("notVerified")}</span>${tierBadge(s.reliability)}</div>
        </div>
        ${match ? `
        <div class="card">
          <div class="score-hd"><span class="t">${esc(t("matchFor", S.q.qty, plabel(product)))}</span><span class="big">${Math.round(match.score)}</span></div>
          ${bars(match.breakdown)}
          <p class="sub" style="margin:12px 0 0">${esc(t("priceNote", Math.round(match.breakdown.priceScore)))}</p>
        </div>
        <div class="chips"><span class="tag">${esc(plabel(product))}</span>${S.q.qty ? `<span class="tag">${esc(t("requested", S.q.qty))}</span>` : ""}<span class="tag">${fmt(match.pricePerKg)} ${t("perKg")}</span></div>
        ${trendLine((s.products.find((p) => p.product === product) || {}).trend)}`
        : `
        <div class="card"><p class="label caps" style="margin-bottom:12px">${t("currentPrices")}</p>
          ${s.products.length ? s.products.map((p) => `<div style="padding:8px 0;border-top:1px solid var(--border)"><div class="row"><div class="grow"><b>${esc(plabel(p.product))}</b><div class="sub">${t("minOrder", p.minOrderKg)} · ${t("ago", daysBetween(p.reportedAt))}</div></div><b>${fmt(p.pricePerKg)} ${t("perKg")}</b></div>${trendLine(p.trend)}</div>`).join("") : `<div class="sub">—</div>`}
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
        ${planCard()}
        <p class="label caps">${t("account")}</p>
        <button class="link-row" data-go="requests"><span class="ic">${I.list}</span><span class="grow">${t("myRequests")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <button class="link-row" data-go="saved"><span class="ic">${I.bookmark}</span><span class="grow">${t("savedSellers")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <button class="link-row" data-go="notifications"><span class="ic">${I.bell}</span><span class="grow">${t("notifications")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</button>
        <a class="link-row" href="admin.html" target="_blank" rel="noopener"><span class="ic">${I.sliders}</span><span class="grow">${t("adminLink")}</span>${I.chev.replace("<svg", '<svg class="chev"')}</a>
        <p class="label caps" style="margin-top:20px">${t("myProducts")}</p>
        ${store.myProducts.length ? store.myProducts.map((p, i) => `
          <div class="card mp-row" style="padding:12px 14px"><span class="mp-ic">${I.bag}</span>
            <div class="grow"><div class="name">${esc(p.name)}</div><div class="sub">${esc(t("catLabel", p.category))} · ${esc(p.place || provLabel(p.province))}</div></div>
            <div class="price" style="font-size:15px">${fmt(p.price)}<small>${t("perKgShort")}</small></div>
            <button class="x" data-act="removeProduct" data-i="${i}" aria-label="Remove">${I.close}</button></div>`).join("")
          : `<p class="sub wrap" style="margin:0 0 10px">${t("noProducts")}</p>`}
        <button class="btn" style="margin-bottom:6px" data-act="addProduct">${I.plus}${t("addProduct")}</button>
        <p class="sub wrap" style="margin:0 0 20px;text-align:center">${t("demoNote")}</p>
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
      const h = await api(`/history/${sellerId}/${product}`);
      const s0 = S.sellerCache[sellerId] || (await loadSeller(sellerId));
      const series = h.series, last = h.current, pct = h.changePct;
      const fc = h.forecast ? h.forecast.points : [];
      const all = series.concat(fc);
      const min = Math.min(...all), max = Math.max(...all);
      const W = 320, H = 150, pad = 6;
      const x = (i) => pad + (i / (all.length - 1)) * (W - pad * 2);
      const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
      const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const fpts = fc.length ? [series.length - 1, ...fc.map((_, i) => series.length + i)].map((i) => `${x(i).toFixed(1)},${y(all[i]).toFixed(1)}`).join(" ") : "";
      const down = pct <= 0;
      const v = h.forecast && h.forecast.verdict;
      const verdictText = v === "down" ? t("verdictDown", h.forecast.pct) : v === "up" ? t("verdictUp", h.forecast.pct) : v === "flat" ? t("verdictFlat") : "";
      return `
        ${header(t("history"), `${plabel(h.product)} · ${h.bazaar}, ${provLabel(h.province)}`)}
        <div class="chart-wrap">
          <div><span class="big">${fmt(last)}</span> <span class="sub">${t("perKg")} ${t("today")}</span></div>
          <span class="trend ${down ? "down" : "up"}">${down ? I.trendDown : I.trend}${t("vs30", pct)}</span>
          <div class="axis"><span>${fmt(max)}</span><span>${t("perKg")}</span></div>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3E5CF6" stop-opacity=".25"/><stop offset="1" stop-color="#3E5CF6" stop-opacity="0"/></linearGradient></defs>
            <line x1="0" x2="${W}" y1="${pad}" y2="${pad}" stroke="#E2E4EC" stroke-dasharray="3 3"/><line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" stroke="#E2E4EC" stroke-dasharray="3 3"/>
            ${fc.length ? `<rect x="${x(series.length - 1)}" y="0" width="${W - x(series.length - 1)}" height="${H}" fill="#F7C94C" fill-opacity=".12"/>` : ""}
            <polygon points="${x(0)},${H - pad} ${pts} ${x(series.length - 1)},${H - pad}" fill="url(#g)"/>
            <polyline points="${pts}" fill="none" stroke="#3E5CF6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
            ${fpts ? `<polyline points="${fpts}" fill="none" stroke="#E08A1E" stroke-width="2.5" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(all.length - 1)}" cy="${y(all[all.length - 1])}" r="4" fill="#E08A1E"/>` : ""}
            <circle cx="${x(series.length - 1)}" cy="${y(last)}" r="4" fill="#3E5CF6"/>
          </svg>
          <div class="axis"><span>${fmt(min)}</span></div>
          <div class="axis" style="margin-top:6px"><span>${t("daysAgo30")}</span><span>${t("todayLbl")}</span>${fc.length ? `<span style="color:var(--distance)">${t("nextWeek")}</span>` : ""}</div>
        </div>
        ${trendLine(h.trend)}
        <p class="sub wrap" style="margin:0 0 4px">${t("sample")}</p>
        ${h.forecast ? `
          <div class="callout ${v === "down" ? "good" : v === "up" ? "bad" : "neutral"}">${I.thumb}<div><b>${t("forecastTitle")} · ${fmt(fc[fc.length - 1])} ${t("perKg")}</b>${esc(verdictText)}</div></div>`
        : `
          <div class="card soft feature-lock"><div class="row"><span class="ic">${I.lock}</span><div class="grow"><b>${t("forecastTitle")}</b><div class="sub wrap">${t("forecastLocked")}</div></div>${lockTag()}</div>
            <div style="filter:blur(3px);opacity:.6;margin-top:10px" class="callout good">${I.thumb}<div><b>${t("forecastTitle")}</b>${t("verdictDown", 8)}</div></div>
            <button class="btn" data-act="upgrade">${I.lock}${t("unlock")}</button></div>`}
        <button class="btn ${h.forecast ? "" : "ghost"}" style="margin-top:8px" data-act="quickAlert" data-product="${esc(h.product)}" data-price="${last}">${esc(t("setAlertFor", plabel(h.product)))}</button>`;
    },
  };

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

  function planCard() {
    if (!S.me) return "";
    const p = S.me.prices || {};
    if (isEnt()) return `
      <div class="card plan-ent">
        <div class="row"><span class="badge gold">${t("enterprise")}</span><span class="grow"></span><b>${t("perMonth", p.enterpriseUsd)}</b></div>
        <ul class="perks">${["perkUnlimited", "perkTop10", "perkForecast", "perkBasket", "perkAlerts"].map((k) => `<li>${I.check}${t(k)}</li>`).join("")}</ul>
        <button class="sub" style="text-decoration:underline" data-act="downgrade">${t("downgradeDemo")}</button>
      </div>`;
    const pct = Math.min(100, (S.me.used / S.me.limit) * 100);
    return `
      <div class="card">
        <div class="row"><span class="plan" style="margin:0">${t("standard")} · ${t("free")}</span></div>
        <div class="usage" style="margin:12px 0 10px"><span class="meter"><i style="width:${pct}%"></i></span><span>${t("searchesToday", S.me.used, S.me.limit)}${S.me.credits ? ` · ${t("creditsLeft", S.me.credits)}` : ""}</span></div>
        <button class="btn ghost" data-act="buyPack">${t("buyPack", p.creditPackSize, fmt(p.creditPackUzs))}</button>
      </div>
      <div class="card soft">
        <div class="row" style="margin-bottom:8px"><span class="badge gold">${t("enterprise")}</span><span class="grow"></span><b>${t("perMonth", p.enterpriseUsd)}</b></div>
        <p class="sub wrap" style="margin:0 0 10px">${t("upgradeSub")}</p>
        <ul class="perks">${["perkUnlimited", "perkTop10", "perkForecast", "perkBasket", "perkAlerts"].map((k) => `<li>${I.check}${t(k)}</li>`).join("")}</ul>
        <button class="btn" data-act="upgrade">${I.star}${t("upgrade")}</button>
      </div>`;
  }
  function weightsCard(w) {
    const pc = (v) => Math.round(v * 100);
    return `
      <div class="card" style="padding:14px 16px">
        <div class="row" style="margin-bottom:8px">${I.sliders.replace("<svg", '<svg style="width:16px;height:16px;color:var(--primary)"')}<b class="grow">${t("weightsTitle")}</b><span class="badge gold">${t("enterprise")}</span></div>
        ${[["price", t("price")], ["quality", t("quality")], ["distance", t("distance")]].map(([k, l]) => `
          <label class="wrow"><span>${l}</span><input type="range" min="0" max="100" value="${pc(w[k])}" data-w="${k}" /><b data-wv="${k}">${pc(w[k])}%</b></label>`).join("")}
        <button class="btn sm" style="margin-top:8px" data-act="applyWeights">${t("apply")}</button>
      </div>`;
  }
  function limitSheet() {
    const p = S.me && S.me.prices || {};
    sheet(`
      <h3>${t("limitTitle")}</h3><p class="sub wrap">${t("limitBody", S.me ? S.me.limit : 5)}</p>
      <button class="btn ghost" data-act="buyPack">${t("buyPack", p.creditPackSize, fmt(p.creditPackUzs || 0))}</button>
      <button class="btn" data-act="upgrade">${I.star}${t("upgrade")}</button>`);
  }
  function upgradeSheet() {
    const p = S.me && S.me.prices || {};
    sheet(`
      <div class="row" style="margin-bottom:6px"><span class="badge gold">${t("enterprise")}</span><span class="grow"></span><b>${t("perMonth", p.enterpriseUsd)}</b></div>
      <h3>${t("upgrade")}</h3><p class="sub wrap">${t("upgradeSub")}</p>
      <ul class="perks">${["perkUnlimited", "perkTop10", "perkForecast", "perkBasket", "perkAlerts"].map((k) => `<li>${I.check}${t(k)}</li>`).join("")}</ul>
      <button class="btn" data-act="pay">${t("payNow", p.enterpriseUsd)}</button>`);
  }
  async function pay() {
    closeSheet();
    try {
      const r = await api("/me/upgrade", { method: "POST", body: JSON.stringify({ tier: "enterprise" }) });
      S.me = { ...S.me, ...r.usage }; S.weights = null;
      try { tg.HapticFeedback.notificationOccurred("success"); } catch {}
      popup(t("upgraded"), t("upgradedBody"), () => render());
      render();
    } catch (e) { toast(t("offline")); }
  }
  async function downgrade() {
    try { const r = await api("/me/upgrade", { method: "POST", body: JSON.stringify({ tier: "standard" }) }); S.me = { ...S.me, ...r.usage }; S.weights = null; S.quote = null; render(); } catch { toast(t("offline")); }
  }
  async function buyPack() {
    closeSheet();
    try { const r = await api("/me/credits", { method: "POST", body: "{}" }); S.me = { ...S.me, ...r.usage }; haptic("medium"); toast(t("packBought", r.added)); render(); } catch { toast(t("offline")); }
  }
  async function getQuote() {
    const text = document.getElementById("basket").value.trim();
    if (!text) return;
    S.basketText = text; S.loading = true; S.quote = null; render();
    try {
      S.quote = await api("/quote", { method: "POST", body: JSON.stringify({ text, province: S.province, lat: S.location && S.location.lat, lng: S.location && S.location.lng }) });
    } catch (e) {
      if (e.status === 403) { S.loading = false; S.me = { ...S.me, ...(e.body && e.body.usage) }; render(); return upgradeSheet(); }
      toast(e.status === 400 ? t("unknownProduct") : t("offline"));
    }
    S.loading = false; haptic(); render();
  }

  let draftLoc = null;
  function addProductSheet() {
    draftLoc = null;
    const cats = S.meta.categories;
    sheet(`
      <h3>${t("addProduct")}</h3><p class="sub wrap">${t("addProductSub")}</p>
      <label class="field"><span>${t("productName")}</span><input id="ap-name" list="ap-list" autocomplete="off" placeholder="${t("productNamePh")}" /><datalist id="ap-list">${S.meta.products.map((p) => `<option value="${esc(p.label[S.lang] || p.label.en)}">`).join("")}</datalist></label>
      <div class="field"><span>${t("category")}</span><div class="seg" id="ap-cat">${cats.map((c, i) => `<button type="button" class="chip sm ${i === 0 ? "on" : ""}" data-apcat="${c.key}">${esc(c.label[S.lang] || c.label.en)}</button>`).join("")}</div></div>
      <label class="field"><span>${t("pricePerKg")}</span><input id="ap-price" type="number" inputmode="numeric" placeholder="12000" /></label>
      <label class="field"><span>${t("location")}</span><select id="ap-prov">${S.meta.provinces.map((p) => `<option value="${p.key}" ${p.key === store.province ? "selected" : ""}>${esc(p.label[S.lang] || p.label.en)}</option>`).join("")}</select></label>
      <label class="field" style="margin-top:8px"><input id="ap-place" placeholder="${t("placePh")}" autocomplete="off" /></label>
      <button type="button" class="btn ghost" style="margin-top:10px" data-act="apLocate" id="ap-locate">${I.pin}<span>${t("useMyLocation")}</span></button>
      <button type="button" class="btn" data-act="saveProduct">${t("saveProduct")}</button>`);
  }
  function popup(title, body, onOk) {
    if (tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast("6.2")) {
      try { tg.showPopup({ title, message: body, buttons: [{ id: "ok", type: "ok" }] }, () => onOk && onOk()); return; } catch { /* fall through */ }
    }
    const el = document.createElement("div"); el.className = "popup";
    el.innerHTML = `<div class="popup-body"><div class="ok">${I.check}</div><h3>${esc(title)}</h3><p class="wrap">${esc(body)}</p><button class="btn" data-popup-ok>${t("ok")}</button></div>`;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-popup-ok]")) { el.remove(); onOk && onOk(); } });
    document.body.appendChild(el);
  }
  function saveProduct() {
    const name = document.getElementById("ap-name").value.trim();
    const price = Number(document.getElementById("ap-price").value);
    const catBtn = document.querySelector("#ap-cat .chip.on");
    const province = document.getElementById("ap-prov").value;
    const place = document.getElementById("ap-place").value.trim();
    if (!name || !price || !catBtn) return toast(t("fillAll"));
    store.myProducts.unshift({ id: Date.now(), name, category: catBtn.dataset.apcat, price, province, place, loc: draftLoc, at: new Date().toISOString() });
    save(); closeSheet(); haptic("medium");
    try { tg.HapticFeedback.notificationOccurred("success"); } catch {}
    popup(t("productAdded"), t("productAddedBody", name), () => render());
    render();
  }
  function locateForProduct() {
    const btn = document.getElementById("ap-locate");
    const done = (lat, lng) => { draftLoc = { lat, lng }; if (btn) { btn.classList.add("soft"); btn.querySelector("span").textContent = t("locationSet"); } haptic(); };
    const lm = tg && tg.LocationManager;
    if (lm && tg.isVersionAtLeast && tg.isVersionAtLeast("8.0")) {
      lm.init(() => lm.getLocation((loc) => { if (loc) done(loc.latitude, loc.longitude); else fallback(); }));
      return;
    }
    fallback();
    function fallback() {
      if (!navigator.geolocation) return toast(t("voiceUnsupported").split(" — ")[0]);
      navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude), () => toast(t("fillAll")), { timeout: 8000 });
    }
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
  document.addEventListener("input", (e) => {
    if (e.target.dataset && e.target.dataset.w) { const b = document.querySelector(`[data-wv="${e.target.dataset.w}"]`); if (b) b.textContent = e.target.value + "%"; }
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    if (f.dataset.form === "search") submitSearch();
  });
  // Some WebViews don't fire submit for the keyboard's "search"/Enter key — handle it explicitly.
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "q") { e.preventDefault(); submitSearch(); } });
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-go],[data-act],[data-cat],[data-prov],[data-scat],[data-sprov],[data-bm],[data-lang],[data-tgl],[data-setprov],[data-apcat]");
    if (!el) return;
    const d = el.dataset;
    if (d.go !== undefined) { haptic(); closeSheet(); return go(d.go); }
    if (d.cat) { S.category = d.cat; return render(); }
    if (d.prov !== undefined) { S.province = d.prov; S.location = null; return render(); }
    if (d.scat) { S.sellersCat = d.scat; return render(); }
    if (d.sprov !== undefined) { S.sellersProv = d.sprov || null; return render(); }
    if (d.bm) { const id = Number(d.bm); store.saved = isSaved(id) ? store.saved.filter((x) => x !== id) : [...store.saved, id]; save(); haptic("medium"); return render(); }
    if (d.lang) { S.lang = store.lang = d.lang; save(); return render(); }
    if (d.apcat) { document.querySelectorAll("#ap-cat .chip").forEach((c) => c.classList.toggle("on", c === el)); return; }
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
      case "addProduct": haptic(); return addProductSheet();
      case "upgrade": haptic(); return upgradeSheet();
      case "pay": haptic("medium"); return pay();
      case "downgrade": return downgrade();
      case "buyPack": haptic(); return buyPack();
      case "quote": haptic(); return getQuote();
      case "requestQuotes": haptic("medium"); try { tg.HapticFeedback.notificationOccurred("success"); } catch {} return toast(t("quotesRequested"));
      case "applyWeights": {
        const w = {}; document.querySelectorAll("[data-w]").forEach((i) => (w[i.dataset.w] = Number(i.value) / 100));
        S.weights = w; haptic(); return runSearch(`${S.q.text}${S.q.qty ? " " + S.q.qty + " kg" : ""}`, { provinceExplicit: true });
      }
      case "saveProduct": return saveProduct();
      case "apLocate": return locateForProduct();
      case "removeProduct": store.myProducts.splice(Number(d.i), 1); save(); haptic(); return render();
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
    if (tg) {
      tg.ready(); tg.expand();
      try { tg.setHeaderColor("#F5F6FA"); tg.setBackgroundColor("#F5F6FA"); tg.setBottomBarColor && tg.setBottomBarColor("#FFFFFF"); } catch {}
      try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch {} // don't close the app when scrolling a list
    }
    await loadStore();
    const tgLang = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code;
    S.lang = store.lang || (tgLang && tgLang.startsWith("ru") ? "ru" : tgLang && tgLang.startsWith("en") ? "en" : "uz");
    S.province = params.get("province") || store.province || DEFAULT_PROVINCE;
    document.documentElement.lang = S.lang;
    try { [S.meta] = await Promise.all([api("/meta"), loadMe()]); } catch { document.getElementById("view").innerHTML = `<div class="empty">${I.store}<div>${esc(t("offline"))}</div><div class="sub" style="margin-top:6px">${esc(API)}</div></div>`; return; }
    // Deep link from the bot: ?product=tomato&region=Chilanzar&lat=..&lng=..
    const lat = parseFloat(params.get("lat")), lng = parseFloat(params.get("lng"));
    if (!isNaN(lat) && !isNaN(lng)) S.location = { lat, lng };
    const screen = params.get("screen");
    if (screen && !params.get("product")) { history.replaceState(null, "", "#" + screen); }
    const product = params.get("product");
    if (product) { if (!location.hash || location.hash === "#search") history.replaceState(null, "", "#search"); await runSearch(product, { region: params.get("region") || undefined }); }
    else render();
  }
  boot();
})();
