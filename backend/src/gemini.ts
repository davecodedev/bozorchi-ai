/**
 * One place for "call Gemini, survive the free tier". Every Gemini feature (query parsing, the
 * assistant, photo verification, transcription) goes through withGeminiModels():
 *   - per-model "thinking off" config — 3.1/3.6/3.7 take thinkingBudget:0, 3.5 takes
 *     thinkingLevel:"minimal", 3.8 takes "low"; a 400 that mentions thinking retries the same
 *     model without it and remembers that;
 *   - cooldowns so a model that just answered 429 (daily quota), 503 (busy) or 404 (retired) is
 *     skipped instead of costing a round-trip on every request;
 *   - a status table for the admin panel.
 */
import { GoogleGenAI, ThinkingLevel, type ThinkingConfig as SdkThinkingConfig } from "@google/genai";

export type ThinkingConfig = SdkThinkingConfig;

const realKey = (k: string | undefined) => (k && !k.includes("FAKE") ? k : undefined);
export const geminiKey = () => realKey(process.env.GEMINI_API_KEY);

const clients = new Map<number, GoogleGenAI>();
export function getGeminiClient(timeoutMs = 30_000): GoogleGenAI {
  let c = clients.get(timeoutMs);
  if (!c) { c = new GoogleGenAI({ apiKey: geminiKey(), vertexai: process.env.GEMINI_VERTEX === "1", httpOptions: { timeout: timeoutMs } }); clients.set(timeoutMs, c); }
  return c;
}

/** null = "this model wants no thinkingConfig at all" (learned from a 400). */
const learned = new Map<string, ThinkingConfig | null>();

/** The config that switches thinking off for a model (Gemini 3 thinks by default and would spend a small output cap on it). */
export function thinkingOff(model: string): ThinkingConfig | undefined {
  if (learned.has(model)) return learned.get(model) ?? undefined;
  if (/transcribe|tts|image|live|omni|embedding/.test(model)) return undefined;
  const v = model.match(/gemini-(\d+)\.(\d+)/);
  if (!v) return undefined;
  const major = Number(v[1]), minor = Number(v[2]);
  if (major === 3 && minor >= 8) return { thinkingLevel: ThinkingLevel.LOW };
  if (major === 3 && minor === 5) return { thinkingLevel: ThinkingLevel.MINIMAL };
  return { thinkingBudget: 0 };
}

interface Cooldown { until: number; reason: string; status?: number; at: number }
const cooldowns = new Map<string, Cooldown>();
const lastOk = new Map<string, { model: string; at: number; ms: number }>();
const MIN = 60_000;
const cool = (model: string, ms: number, reason: string, status?: number) => cooldowns.set(model, { until: Date.now() + ms, reason, status, at: Date.now() });

/** Runs fn against each model in turn; fn receives the model and the thinking config to use (undefined = omit). */
export async function withGeminiModels<T>(tag: string, models: string[], fn: (model: string, thinking: ThinkingConfig | undefined) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  let tried = 0;
  for (const model of models) {
    const cd = cooldowns.get(model);
    if (cd && cd.until > Date.now()) continue;
    tried++;
    let thinking = thinkingOff(model);
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now();
      try {
        const r = await fn(model, thinking);
        lastOk.set(tag, { model, at: Date.now(), ms: Date.now() - t0 });
        if (thinking && !learned.has(model)) learned.set(model, thinking);
        return r;
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        const msg = e instanceof Error ? e.message : String(e);
        if (status === 400 && thinking && /thinking/i.test(msg)) { learned.set(model, null); thinking = undefined; console.warn(`${tag}(gemini): ${model} rejects thinkingConfig — retrying without`); continue; }
        if (status === 429) cool(model, 5 * MIN, "quota exhausted (free tier is per model per day)", status);
        else if (status === 404) cool(model, 24 * 60 * MIN, "model not available for this key", status);
        else if (status === 503 || status === 500 || status === 502 || status === 504 || /timeout|fetch failed|ECONN|socket/i.test(msg)) cool(model, 30_000, "busy / unreachable", status);
        else if (status === 400) cool(model, 10 * MIN, `rejected request: ${msg.slice(0, 80)}`, status);
        else throw e;
        console.warn(`${tag}(gemini): ${model} → ${status ?? msg.slice(0, 60)}, trying next model`);
        break;
      }
    }
  }
  if (!tried) throw Object.assign(new Error(`all Gemini models are cooling down (${tag})`), { status: 503 });
  throw lastErr ?? new Error(`no Gemini model answered (${tag})`);
}

/** For the admin panel: what each model is doing right now. */
export function geminiStatus(chains: Record<string, string[]>) {
  const now = Date.now();
  const models = [...new Set(Object.values(chains).flat())].map((model) => {
    const cd = cooldowns.get(model);
    return { model, thinking: learned.has(model) ? learned.get(model) ?? "none" : thinkingOff(model) ?? "none", coolingDown: Boolean(cd && cd.until > now), reason: cd && cd.until > now ? cd.reason : null, status: cd && cd.until > now ? cd.status ?? null : null, coolsAt: cd && cd.until > now ? new Date(cd.until) : null };
  });
  return { keyConfigured: Boolean(geminiKey()), chains, models, lastSuccess: Object.fromEntries([...lastOk].map(([k, v]) => [k, { ...v, at: new Date(v.at) }])) };
}
/** Tests / admin: forget cooldowns. */
export function resetGeminiState() { cooldowns.clear(); learned.clear(); lastOk.clear(); }
