/** Three-language strings. Picked from ctx.from.language_code — uz is the default. */
export type Lang = "uz" | "ru" | "en";

export function pickLang(code?: string): Lang {
  if (!code) return "uz";
  if (code.startsWith("ru")) return "ru";
  if (code.startsWith("en")) return "en";
  return "uz";
}

const tierName = (t: string) => ({ free: "Free", pro: "Pro", max: "Max" })[t] ?? t;

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
    contactBtn: (name: string) => `📞 ${name}`,
    contactMsg: (c: { sellerName: string; phone: string | null; bazaar: string; region: string; mapsUrl: string }) =>
      `📞 <b>${c.sellerName}</b>\n☎️ ${c.phone ?? "—"}\n📍 ${c.bazaar}, ${c.region}\n🗺 <a href="${c.mapsUrl}">Xaritada ochish</a>`,
    contactUsage: (used: number, quota: number, unlimited: boolean) => unlimited ? `\n\n<i>Max reja · cheksiz kontaktlar</i>` : `\n\n<i>Bu oy: ${used}/${quota} kontakt ishlatildi</i>`,
    sellerNotified: (notice: string) => `\n\n📨 <i>Sotuvchi ko'radi:</i> ${notice}`,
    alreadyUnlocked: "🔓 Bu kontakt allaqachon ochilgan — limitdan yechilmadi.",
    quotaExceeded: (tier: string, quota: number, next: { tier: string; quota: number; priceUsd: number } | null) =>
      `⛔ ${tierName(tier)} reja: ${quota}/${quota} kontakt ishlatildi (30 kun).` +
      (next ? `\n\n⭐ <b>${tierName(next.tier)}</b> rejaga o'ting — ${next.quota >= 500 ? "cheksiz" : next.quota + " ta"} kontakt/oy, $${next.priceUsd}/oy.\nDemo: <code>/upgrade ${next.tier}</code>` : ""),
    upgraded: (tier: string, quota: number, verified: boolean) => `✅ Reja: <b>${tierName(tier)}</b> — ${quota >= 500 ? "cheksiz" : quota + " ta"} kontakt/oy.${verified ? "\n✅ Endi siz <b>Tasdiqlangan xaridor</b>siz — sotuvchilar buni ko'radi." : ""}`,
    upgradeUsage: "Foydalanish: /upgrade free | pro | max",
    askProduct: "🤔 Qaysi mahsulot kerakligini tushunmadim. Masalan: <i>500 kg pomidor, Chilonzor</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Tushundim: <b>${p}</b>${q ? ` · ${q} kg` : ""}${r ? ` · ${r}` : ""}`,
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
    contactBtn: (name: string) => `📞 ${name}`,
    contactMsg: (c: { sellerName: string; phone: string | null; bazaar: string; region: string; mapsUrl: string }) =>
      `📞 <b>${c.sellerName}</b>\n☎️ ${c.phone ?? "—"}\n📍 ${c.bazaar}, ${c.region}\n🗺 <a href="${c.mapsUrl}">Открыть на карте</a>`,
    contactUsage: (used: number, quota: number, unlimited: boolean) => unlimited ? `\n\n<i>Тариф Max · контакты без лимита</i>` : `\n\n<i>В этом месяце: ${used}/${quota} контактов</i>`,
    sellerNotified: (notice: string) => `\n\n📨 <i>Продавец видит:</i> ${notice}`,
    alreadyUnlocked: "🔓 Этот контакт уже открыт — лимит не списан.",
    quotaExceeded: (tier: string, quota: number, next: { tier: string; quota: number; priceUsd: number } | null) =>
      `⛔ Тариф ${tierName(tier)}: ${quota}/${quota} контактов использовано (30 дней).` +
      (next ? `\n\n⭐ Перейдите на <b>${tierName(next.tier)}</b> — ${next.quota >= 500 ? "безлимит" : next.quota} контактов/мес, $${next.priceUsd}/мес.\nДемо: <code>/upgrade ${next.tier}</code>` : ""),
    upgraded: (tier: string, quota: number, verified: boolean) => `✅ Тариф: <b>${tierName(tier)}</b> — ${quota >= 500 ? "безлимит" : quota} контактов/мес.${verified ? "\n✅ Теперь вы <b>Проверенный покупатель</b> — продавцы это видят." : ""}`,
    upgradeUsage: "Использование: /upgrade free | pro | max",
    askProduct: "🤔 Не понял, какой товар нужен. Например: <i>500 кг помидор, Чиланзар</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Понял: <b>${p}</b>${q ? ` · ${q} кг` : ""}${r ? ` · ${r}` : ""}`,
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
    contactBtn: (name: string) => `📞 ${name}`,
    contactMsg: (c: { sellerName: string; phone: string | null; bazaar: string; region: string; mapsUrl: string }) =>
      `📞 <b>${c.sellerName}</b>\n☎️ ${c.phone ?? "—"}\n📍 ${c.bazaar}, ${c.region}\n🗺 <a href="${c.mapsUrl}">Open in maps</a>`,
    contactUsage: (used: number, quota: number, unlimited: boolean) => unlimited ? `\n\n<i>Max plan · unlimited contacts</i>` : `\n\n<i>This month: ${used}/${quota} contacts used</i>`,
    sellerNotified: (notice: string) => `\n\n📨 <i>The seller sees:</i> ${notice}`,
    alreadyUnlocked: "🔓 Already unlocked — not charged against your quota.",
    quotaExceeded: (tier: string, quota: number, next: { tier: string; quota: number; priceUsd: number } | null) =>
      `⛔ ${tierName(tier)} plan: ${quota}/${quota} contacts used (30 days).` +
      (next ? `\n\n⭐ Upgrade to <b>${tierName(next.tier)}</b> — ${next.quota >= 500 ? "unlimited" : next.quota} contacts/month, $${next.priceUsd}/mo.\nDemo: <code>/upgrade ${next.tier}</code>` : ""),
    upgraded: (tier: string, quota: number, verified: boolean) => `✅ Plan: <b>${tierName(tier)}</b> — ${quota >= 500 ? "unlimited" : quota} contacts/month.${verified ? "\n✅ You are now a <b>Verified buyer</b> — sellers see this." : ""}`,
    upgradeUsage: "Usage: /upgrade free | pro | max",
    askProduct: "🤔 I couldn't tell which product you need. For example: <i>500 kg tomatoes, Chilanzar</i>",
    understood: (p: string, q: number | null, r: string | null) => `🧠 Got it: <b>${p}</b>${q ? ` · ${q} kg` : ""}${r ? ` · ${r}` : ""}`,
  },
} as const;

export { tierName };

export type Strings = (typeof S)[Lang];
export const t = (lang: Lang): Strings => S[lang];
