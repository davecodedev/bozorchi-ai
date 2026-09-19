/**
 * LLM query parsing — turns a messy buyer message ("menga span piyoz kerakk tezroq",
 * "500 кг помидор Чиланзар") into structured fields.
 *
 * Isolated on purpose: no DB, no Express. A failure here must never crash the bot, so
 * parseQuery() swallows every error and returns all-nulls; callers fall back gracefully.
 *
 * Two interchangeable providers, chosen from env (NLP_PROVIDER, else whichever key is set):
 *   - gemini    : GEMINI_API_KEY   (Gemini Developer API; GEMINI_VERTEX=1 to use Vertex AI instead)
 *   - anthropic : ANTHROPIC_API_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export interface ParsedQuery {
  product: string | null;
  quantity: number | null;
  unit: string | null;
  region: string | null;
}

export const ANTHROPIC_MODEL = "claude-haiku-4-5"; // fast + cheap; right size for structured extraction
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash"; // gemini-2.5-flash is closed to new accounts
export const NLP_MAX_TOKENS = 200;

export const SYSTEM_PROMPT =
  "Extract structured data from a buyer's message about what they want to buy in an Uzbekistan bazaar. " +
  "Respond with ONLY a JSON object, no other text, no markdown fences:\n" +
  '{"product": string or null, "quantity": number or null, "unit": string or null, "region": string or null}\n' +
  "Handle Uzbek, Russian, and mixed-language input, typos, and voice-transcript messiness. " +
  "Normalize units to kg where the buyer clearly means weight. If a field isn't mentioned or unclear, use null. " +
  "Never invent a quantity: if the message contains no number, quantity and unit must be null. " +
  "region must be a real place in Uzbekistan (city, region or Tashkent district); otherwise null.";

export const EMPTY: ParsedQuery = Object.freeze({ product: null, quantity: null, unit: null, region: null });

/** A provider takes the raw text and returns the model's text output. */
export interface Provider {
  name: "anthropic" | "gemini";
  call(text: string): Promise<string>;
}

const realKey = (k: string | undefined) => (k && !k.includes("FAKE") ? k : undefined);

/** Minimal surface we need from the Anthropic SDK — lets tests inject a fake without network. */
export type MessagesClient = { messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> } };

export function anthropicProvider(client: MessagesClient = new Anthropic({ maxRetries: 0, timeout: 10_000 })): Provider {
  return {
    name: "anthropic",
    async call(text) {
      const res = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: NLP_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      });
      return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    },
  };
}

/** Minimal surface we need from @google/genai. */
export type GenAIClient = { models: { generateContent: (p: { model: string; contents: string; config?: Record<string, unknown> }) => Promise<{ text?: string }> } };

export function geminiProvider(client?: GenAIClient, apiKey = realKey(process.env.GEMINI_API_KEY)): Provider {
  const c: GenAIClient =
    client ??
    // The Gemini Developer endpoint accepts both "AIza…" and express-mode "AQ.…" keys.
    // Set GEMINI_VERTEX=1 to route through Vertex AI instead (needs aiplatform API enabled on the project).
    new GoogleGenAI({ apiKey, vertexai: process.env.GEMINI_VERTEX === "1", httpOptions: { timeout: 10_000 } });
  return {
    name: "gemini",
    async call(text) {
      const res = await c.models.generateContent({
        model: GEMINI_MODEL,
        contents: text,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: NLP_MAX_TOKENS,
          responseMimeType: "application/json",
          temperature: 0,
          // Gemini 3.x "thinks" by default and would spend the whole 200-token cap on it — this is a
          // simple extraction, so turn thinking off.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return res.text ?? "";
    },
  };
}

/** Which provider env selects, or null when no key is configured. */
export function selectProviderName(): Provider["name"] | null {
  const gem = realKey(process.env.GEMINI_API_KEY);
  const ant = realKey(process.env.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_AUTH_TOKEN;
  const pref = process.env.NLP_PROVIDER;
  if (pref === "gemini" && gem) return "gemini";
  if (pref === "anthropic" && ant) return "anthropic";
  return gem ? "gemini" : ant ? "anthropic" : null;
}

/** True when some provider has a credential. */
export const nlpAvailable = () => selectProviderName() !== null;

let defaultProvider: Provider | undefined;
function getProvider(): Provider | null {
  if (defaultProvider) return defaultProvider;
  const name = selectProviderName();
  if (!name) return null;
  return (defaultProvider = name === "gemini" ? geminiProvider() : anthropicProvider());
}

export async function parseQuery(rawText: string, provider: Provider | null = getProvider()): Promise<ParsedQuery> {
  const text = (rawText ?? "").trim();
  if (!text || !provider) return { ...EMPTY };
  try {
    return coerce(extractJson(await provider.call(text)));
  } catch (e) {
    // Network, auth, rate-limit, malformed JSON — all handled the same way: degrade, don't crash.
    console.warn(`nlp(${provider.name}): parseQuery failed:`, e instanceof Error ? e.message : e);
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
