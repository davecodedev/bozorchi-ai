/** Three-language strings. Picked from ctx.from.language_code — uz is the default. */
export type Lang = "uz" | "ru" | "en";

export function pickLang(code?: string): Lang {
  if (!code) return "uz";
  if (code.startsWith("ru")) return "ru";
  if (code.startsWith("en")) return "en";
  return "uz";
}

const S = {
  uz: {
    start:
      "👋 <b>Bozorchi AI</b>ga xush kelibsiz!\n\n" +
      "Bozorlardagi eng yaxshi narx, sifat va masofani siz uchun solishtiramiz.\n\n" +
      "Ilovani oching yoki shu yerga nima kerakligini yozing.",
    openAppBtn: "🚀 Ilovani ochish",
    locationPrompt: "📍 Yaqin sotuvchilarni topish uchun joylashuvingizni yuborishingiz mumkin.",
    help:
      "Mahsulot nomini yozing: pomidor / kartoshka / piyoz.\n" +
      "Tuman qo'shsangiz ham bo'ladi: <i>pomidor Chilonzor</i>.\n" +
      "📍 Joylashuv yuboring — masofani aniq hisoblayman.",
    unknownProduct: (q: string) =>
      `😕 "<b>${q}</b>" topilmadi. Hozircha: pomidor, kartoshka, piyoz.`,
    noResults: "Hozircha bu mahsulot bo'yicha takliflar yo'q.",
    header: (label: string, n: number, where: string) =>
      `🏆 <b>${label}</b> — ${n} ta taklifdan eng yaxshi 3 tasi\n📍 ${where}\n`,
    aiPick: "AI tanlovi",
    verified: "tasdiqlangan",
    perKg: "so'm/kg",
    minOrder: (kg: number) => `min. ${kg} kg`,
    away: (km: number) => `${km} km`,
    reported: (d: number) => (d === 0 ? "bugun" : d === 1 ? "kecha" : `${d} kun oldin`),
    score: "ball",
    openApp: "📱 Mini App'da ochish",
    locationSaved: "📍 Joylashuv saqlandi! Endi mahsulot nomini yozing.",
    locationBtn: "📍 Joylashuvni yuborish",
    nearMe: "Sizga yaqin",
    tashkent: "Toshkent",
    voiceNoStt:
      "🎤 Ovozli xabar qabul qilindi, lekin nutqni tanish hali ulanmagan. Iltimos, matn yozing.",
    voiceHeard: (t: string) => `🎤 Eshitdim: <i>${t}</i>`,
    backendDown: "⚠️ Server javob bermayapti. Bir ozdan keyin qayta urinib ko'ring.",
    breakdown: (p: number, q: number, d: number) => `narx ${p} · sifat ${q} · masofa ${d}`,
    limitReached: "⛔ Bugungi bepul qidiruvlar tugadi (5 ta/kun).\nMini App'da qo'shimcha paket oling yoki Enterprise'ga o'ting — cheksiz qidiruv, 7 kunlik narx prognozi va savat bo'yicha taklif.",
    upgradeBtn: "⭐ Enterprise'ga o'tish",
    askProduct: "🤔 Qaysi mahsulot kerakligini tushunmadim. Masalan: <i>500 kg pomidor, Chilonzor</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Tushundim: <b>${p}</b>${q ? ` · ${q} kg` : ""}${r ? ` · ${r}` : ""}`,
    usageLine: (used: number, limit: number) => `\n\n<i>Bugun: ${used}/${limit} bepul qidiruv</i>`,
  },
  ru: {
    start:
      "👋 Добро пожаловать в <b>Bozorchi AI</b>!\n\n" +
      "Сравниваем цену, качество и расстояние по базарам за вас.\n\n" +
      "Откройте приложение или просто напишите, что вам нужно.",
    openAppBtn: "🚀 Открыть приложение",
    locationPrompt: "📍 Можете отправить геолокацию — найду ближайших продавцов.",
    help:
      "Напишите название: помидор / картошка / лук.\n" +
      "Можно добавить район: <i>помидор Чиланзар</i>.\n" +
      "📍 Отправьте геолокацию — посчитаю точное расстояние.",
    unknownProduct: (q: string) =>
      `😕 "<b>${q}</b>" не найдено. Пока доступны: помидор, картошка, лук.`,
    noResults: "Пока нет предложений по этому товару.",
    header: (label: string, n: number, where: string) =>
      `🏆 <b>${label}</b> — топ-3 из ${n} предложений\n📍 ${where}\n`,
    aiPick: "Выбор AI",
    verified: "проверен",
    perKg: "сум/кг",
    minOrder: (kg: number) => `мин. ${kg} кг`,
    away: (km: number) => `${km} км`,
    reported: (d: number) => (d === 0 ? "сегодня" : d === 1 ? "вчера" : `${d} дн. назад`),
    score: "балл",
    openApp: "📱 Открыть в Mini App",
    locationSaved: "📍 Геолокация сохранена! Теперь напишите название товара.",
    locationBtn: "📍 Отправить геолокацию",
    nearMe: "Рядом с вами",
    tashkent: "Ташкент",
    voiceNoStt:
      "🎤 Голосовое получено, но распознавание речи ещё не подключено. Напишите текстом.",
    voiceHeard: (t: string) => `🎤 Услышал: <i>${t}</i>`,
    backendDown: "⚠️ Сервер не отвечает. Попробуйте чуть позже.",
    breakdown: (p: number, q: number, d: number) => `цена ${p} · качество ${q} · расстояние ${d}`,
    limitReached: "⛔ Бесплатные поиски на сегодня закончились (5 в день).\nКупите пакет в Mini App или перейдите на Enterprise — безлимит, прогноз цен на 7 дней и расчёт корзины.",
    upgradeBtn: "⭐ Перейти на Enterprise",
    askProduct: "🤔 Не понял, какой товар нужен. Например: <i>500 кг помидор, Чиланзар</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Понял: <b>${p}</b>${q ? ` · ${q} кг` : ""}${r ? ` · ${r}` : ""}`,
    usageLine: (used: number, limit: number) => `\n\n<i>Сегодня: ${used}/${limit} бесплатных поисков</i>`,
  },
  en: {
    start:
      "👋 Welcome to <b>Bozorchi AI</b>!\n\n" +
      "We compare price, quality and distance across the bazaars for you.\n\n" +
      "Open the app, or just type what you need here.",
    openAppBtn: "🚀 Open the app",
    locationPrompt: "📍 You can share your location and I'll find the nearest sellers.",
    help:
      "Type a product: tomato / potato / onion.\n" +
      "Add a district if you like: <i>tomato Chilanzar</i>.\n" +
      "📍 Share your location for exact distances.",
    unknownProduct: (q: string) =>
      `😕 "<b>${q}</b>" not found. Available for now: tomato, potato, onion.`,
    noResults: "No offers for this product yet.",
    header: (label: string, n: number, where: string) =>
      `🏆 <b>${label}</b> — top 3 of ${n} offers\n📍 ${where}\n`,
    aiPick: "AI pick",
    verified: "verified",
    perKg: "UZS/kg",
    minOrder: (kg: number) => `min. ${kg} kg`,
    away: (km: number) => `${km} km`,
    reported: (d: number) => (d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`),
    score: "score",
    openApp: "📱 Open in Mini App",
    locationSaved: "📍 Location saved! Now type a product name.",
    locationBtn: "📍 Share location",
    nearMe: "Near you",
    tashkent: "Tashkent",
    voiceNoStt:
      "🎤 Got your voice message, but speech recognition isn't connected yet. Please type instead.",
    voiceHeard: (t: string) => `🎤 I heard: <i>${t}</i>`,
    backendDown: "⚠️ The server isn't responding. Please try again in a moment.",
    breakdown: (p: number, q: number, d: number) => `price ${p} · quality ${q} · distance ${d}`,
    limitReached: "⛔ You've used today's free searches (5/day).\nBuy a pack in the Mini App or go Enterprise — unlimited searches, 7-day price forecasts and basket quotes.",
    upgradeBtn: "⭐ Go Enterprise",
    askProduct: "🤔 I couldn't tell which product you need. For example: <i>500 kg tomatoes, Chilanzar</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Got it: <b>${p}</b>${q ? ` · ${q} kg` : ""}${r ? ` · ${r}` : ""}`,
    usageLine: (used: number, limit: number) => `\n\n<i>Today: ${used}/${limit} free searches</i>`,
  },
} as const;

export type Strings = (typeof S)[Lang];
export const t = (lang: Lang): Strings => S[lang];
