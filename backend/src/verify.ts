/**
 * Listing verification before a product is posted: does the photo show the named product, is the
 * category right, is the price plausible, is anything inappropriate? Deterministic checks (catalog,
 * market price) run always; Gemini looks at the photo when a key is available.
 *
 * severity "error" blocks posting; "warning" is shown but allowed.
 */
import { getGeminiClient, withGeminiModels } from "./gemini.js";
import { marketDailyPrices } from "./forecast.js";
import { GEMINI_MODELS } from "./nlp.js";
import { CATEGORIES, productDef, resolveProduct, type Category } from "./products.js";

export interface Issue { field: "photo" | "name" | "category" | "price" | "content"; severity: "error" | "warning"; code: string; message: { uz: string; ru: string; en: string } }
export interface VerifyInput { name: string; category: string; price: number; province?: string; photo?: string | null; unit?: string }
export interface VerifyResult {
  ok: boolean;
  issues: Issue[];
  detected: { product: string | null; label?: { uz: string; ru: string; en: string }; category: Category | null; photoShows: string | null; photoMatches: boolean | null; appropriate: boolean | null; marketMedian: number | null; priceRatio: number | null };
  aiChecked: boolean;
}

const realKey = (k: string | undefined) => (k && !k.includes("FAKE") ? k : undefined);

const PHOTO_PROMPT = (name: string, category: string) =>
  `You are checking a marketplace listing for an Uzbekistan bazaar app. The seller named the product "${name}" (category: ${category}). Look at the photo and respond with ONLY JSON, no fences:\n` +
  `{"shows": string (what the photo actually shows, 2-6 words, in English), "matches": boolean (does the photo show "${name}" or that kind of product?), "appropriate": boolean (false if the image contains nudity, violence, weapons, drugs, hate symbols, or is clearly not a product photo such as a screenshot, meme, or blank image), "quality": "ok"|"blurry"|"dark"|"tiny", "note": string (one short sentence)}`;

async function judgePhoto(dataUrl: string, name: string, category: string): Promise<{ shows: string; matches: boolean; appropriate: boolean; quality: string; note: string } | null> {
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return await withGeminiModels("verify", GEMINI_MODELS, async (model, thinking) => {
      const res = await getGeminiClient(30_000).models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: PHOTO_PROMPT(name, category) }] }],
        config: { maxOutputTokens: thinking ? 200 : 800, temperature: 0, responseMimeType: "application/json", ...(thinking ? { thinkingConfig: thinking } : {}) },
      });
      const txt = res.text ?? "";
      const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
      return { shows: String(j.shows ?? ""), matches: Boolean(j.matches), appropriate: j.appropriate !== false, quality: String(j.quality ?? "ok"), note: String(j.note ?? "") };
    });
  } catch (e) {
    console.warn("verify: photo judge failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function verifyListing(input: VerifyInput): Promise<VerifyResult> {
  const issues: Issue[] = [];
  const name = (input.name ?? "").trim();
  const key = name ? resolveProduct(name) : null;
  const def = key ? productDef(key) : undefined;
  const detected: VerifyResult["detected"] = { product: key, label: def?.label, category: def?.category ?? null, photoShows: null, photoMatches: null, appropriate: null, marketMedian: null, priceRatio: null };

  if (!name || name.length < 2) issues.push({ field: "name", severity: "error", code: "name_missing", message: { uz: "Mahsulot nomini kiriting.", ru: "Укажите название товара.", en: "Enter a product name." } });
  if (!def && name.length >= 2) issues.push({ field: "name", severity: "warning", code: "name_unknown", message: { uz: `"${name}" katalogda topilmadi — xaridorlar qidiruvda topishi qiyin bo'lishi mumkin.`, ru: `«${name}» нет в каталоге — покупателям будет сложнее найти.`, en: `"${name}" isn't in the catalog — buyers may not find it in search.` } });
  if (def && input.category && def.category !== input.category) {
    const want = CATEGORIES.find((c) => c.key === def.category)?.label;
    issues.push({ field: "category", severity: "error", code: "category_mismatch", message: { uz: `${def.label.uz} "${want?.uz}" toifasiga kiradi, siz boshqa toifani tanladingiz.`, ru: `${def.label.ru} относится к категории «${want?.ru}», выбрана другая.`, en: `${def.label.en} belongs to "${want?.en}", a different category was chosen.` } });
  }

  const price = Number(input.price);
  if (!(price > 0)) issues.push({ field: "price", severity: "error", code: "price_missing", message: { uz: "Narxni kiriting.", ru: "Укажите цену.", en: "Enter a price." } });
  else if (def) {
    const series = await marketDailyPrices(def.key, input.province || "toshkent-shahri", 7);
    const median = series.length ? series[series.length - 1].price : def.basePrice;
    detected.marketMedian = median; detected.priceRatio = Math.round((price / median) * 100) / 100;
    const unit = def.unit;
    if (price < median * 0.3) issues.push({ field: "price", severity: "error", code: "price_too_low", message: { uz: `${price.toLocaleString("en-US")} so'm/${unit} bozor narxidan (${median.toLocaleString("en-US")}) juda past — xatolik yoki firibgarlikka o'xshaydi.`, ru: `${price.toLocaleString("en-US")} сум/${unit} слишком ниже рынка (${median.toLocaleString("en-US")}) — похоже на ошибку.`, en: `${price.toLocaleString("en-US")} so'm/${unit} is far below the market (${median.toLocaleString("en-US")}) — looks like a typo or a scam.` } });
    else if (price > median * 3) issues.push({ field: "price", severity: "error", code: "price_too_high", message: { uz: `${price.toLocaleString("en-US")} so'm/${unit} bozor narxidan (${median.toLocaleString("en-US")}) 3 barobardan ko'p — tekshiring.`, ru: `${price.toLocaleString("en-US")} сум/${unit} более чем втрое выше рынка (${median.toLocaleString("en-US")}) — проверьте.`, en: `${price.toLocaleString("en-US")} so'm/${unit} is more than 3× the market (${median.toLocaleString("en-US")}) — please check.` } });
    else if (price > median * 1.6) issues.push({ field: "price", severity: "warning", code: "price_high", message: { uz: `Bozor o'rtachasi ${median.toLocaleString("en-US")} so'm/${unit} — narxingiz ancha yuqori.`, ru: `Средняя по рынку ${median.toLocaleString("en-US")} сум/${unit} — ваша цена заметно выше.`, en: `Market median is ${median.toLocaleString("en-US")} so'm/${unit} — yours is well above it.` } });
  }

  let aiChecked = false;
  if (!input.photo) issues.push({ field: "photo", severity: "error", code: "photo_missing", message: { uz: "Mahsulot rasmini qo'shing — rasmsiz e'lonlar tekshiruvdan o'tmaydi.", ru: "Добавьте фото товара — без фото объявление не проходит проверку.", en: "Add a product photo — listings without one aren't accepted." } });
  else if (realKey(process.env.GEMINI_API_KEY)) {
    const j = await judgePhoto(input.photo, name || "product", input.category || "");
    if (j) {
      aiChecked = true;
      detected.photoShows = j.shows; detected.photoMatches = j.matches; detected.appropriate = j.appropriate;
      if (!j.appropriate) issues.push({ field: "content", severity: "error", code: "inappropriate", message: { uz: `Rasm mahsulot rasmiga o'xshamaydi yoki nomaqbul (${j.shows}).`, ru: `Изображение не похоже на фото товара или недопустимо (${j.shows}).`, en: `The image doesn't look like a product photo or is inappropriate (${j.shows}).` } });
      else if (!j.matches) issues.push({ field: "photo", severity: "error", code: "photo_mismatch", message: { uz: `Rasmda "${j.shows}" ko'rinyapti, "${name}" emas. Mahsulotning o'z rasmini yuklang.`, ru: `На фото «${j.shows}», а не «${name}». Загрузите фото самого товара.`, en: `The photo shows "${j.shows}", not "${name}". Upload a photo of the actual product.` } });
      else if (j.quality !== "ok") issues.push({ field: "photo", severity: "warning", code: `photo_${j.quality}`, message: { uz: `Rasm sifati past (${j.quality}) — aniqroq rasm xaridorlarga ishonch beradi.`, ru: `Качество фото низкое (${j.quality}) — чёткое фото вызывает больше доверия.`, en: `Photo quality is low (${j.quality}) — a clearer photo builds trust.` } });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues, detected, aiChecked };
}
