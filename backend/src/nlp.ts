/**
 * LLM query parsing — turns a messy buyer message ("menga span piyoz kerakk tezroq",
 * "500 кг помидор Чиланзар") into structured fields.
 *
 * Isolated on purpose: no DB, no Express. A failure here must never crash the bot, so
 * parseQuery() swallows every error and returns all-nulls; callers fall back gracefully.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface ParsedQuery {
  product: string | null;
  quantity: number | null;
  unit: string | null;
  region: string | null;
}

export const NLP_MODEL = "claude-haiku-4-5"; // fast + cheap; right size for structured extraction
export const NLP_MAX_TOKENS = 200;

export const SYSTEM_PROMPT =
  "Extract structured data from a buyer's message about what they want to buy in an Uzbekistan bazaar. " +
  "Respond with ONLY a JSON object, no other text, no markdown fences:\n" +
  '{"product": string or null, "quantity": number or null, "unit": string or null, "region": string or null}\n' +
  "Handle Uzbek, Russian, and mixed-language input, typos, and voice-transcript messiness. " +
  "Normalize units to kg where the buyer clearly means weight. If a field isn't mentioned or unclear, use null.";

export const EMPTY: ParsedQuery = Object.freeze({ product: null, quantity: null, unit: null, region: null });

/** True when the backend has a credential the SDK can use. */
export function nlpAvailable(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return Boolean((k && !k.includes("FAKE")) || process.env.ANTHROPIC_AUTH_TOKEN);
}

let defaultClient: Anthropic | undefined;
const getClient = () => (defaultClient ??= new Anthropic({ maxRetries: 0, timeout: 10_000 }));

/** Minimal surface we need from the SDK — lets tests inject a fake without network. */
export type MessagesClient = { messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> } };

export async function parseQuery(rawText: string, client: MessagesClient = getClient()): Promise<ParsedQuery> {
  const text = (rawText ?? "").trim();
  if (!text) return { ...EMPTY };
  try {
    const res = await client.messages.create({
      model: NLP_MODEL,
      max_tokens: NLP_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });
    const out = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    return coerce(extractJson(out));
  } catch (e) {
    // Network, auth, rate-limit, malformed JSON — all handled the same way: degrade, don't crash.
    console.warn("nlp: parseQuery failed:", e instanceof Error ? e.message : e);
    return { ...EMPTY };
  }
}

/** The prompt forbids fences, but be forgiving: pull the first {...} out of whatever came back. */
function extractJson(s: string): unknown {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(s.slice(start, end + 1));
}

/** Force the shape we promised, whatever the model actually emitted. */
function coerce(v: unknown): ParsedQuery {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const num = (x: unknown) => {
    const n = typeof x === "number" ? x : typeof x === "string" ? parseFloat(x.replace(",", ".")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return { product: str(o.product), quantity: num(o.quantity), unit: str(o.unit)?.toLowerCase() ?? null, region: str(o.region) };
}

/** Convert (quantity, unit) to kilograms when the unit is a weight; null otherwise. */
export function toKg(quantity: number | null, unit: string | null): number | null {
  if (quantity == null) return null;
  const u = (unit ?? "kg").toLowerCase();
  if (/^(t|tonna|ton|tons|tonne|tonnes|тонн[аы]?|т)$/.test(u)) return quantity * 1000;
  if (/^(kg|kilogram|kilograms|кг|килограмм)$/.test(u)) return quantity;
  if (/^(g|gram|grams|г|гр|грамм)$/.test(u)) return quantity / 1000;
  return null; // pieces, boxes, sacks… not a weight we can filter on
}
