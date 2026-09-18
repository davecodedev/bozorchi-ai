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
      "👋 <b>Bazarcha</b>ga xush kelibsiz!\n\n" +
      "Qaysi mahsulot kerak? Yozing (masalan, <i>pomidor</i>, <i>2 tonna kartoshka</i>) " +
      "yoki pastdagi tugmalardan tanlang.\n\n" +
      "📍 Joylashuvingizni yuborsangiz, eng yaqin sotuvchilarni topaman.",
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
  },
  ru: {
    start:
      "👋 Добро пожаловать в <b>Bazarcha</b>!\n\n" +
      "Какой товар нужен? Напишите (например, <i>помидоры</i>, <i>2 тонны картошки</i>) " +
      "или выберите кнопкой ниже.\n\n" +
      "📍 Отправьте геолокацию — найду ближайших продавцов.",
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
  },
  en: {
    start:
      "👋 Welcome to <b>Bazarcha</b>!\n\n" +
      "What do you need? Type it (e.g. <i>tomatoes</i>, <i>2 tons of potatoes</i>) " +
      "or pick a button below.\n\n" +
      "📍 Share your location and I'll find the nearest sellers.",
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
  },
} as const;

export type Strings = (typeof S)[Lang];
export const t = (lang: Lang): Strings => S[lang];

/** Quick-pick product buttons shown on /start (reply keyboard). */
export const PRODUCT_BUTTONS: Record<Lang, string[]> = {
  uz: ["🍅 Pomidor", "🥔 Kartoshka", "🧅 Piyoz"],
  ru: ["🍅 Помидор", "🥔 Картошка", "🧅 Лук"],
  en: ["🍅 Tomato", "🥔 Potato", "🧅 Onion"],
};
