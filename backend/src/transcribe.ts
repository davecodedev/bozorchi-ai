/**
 * Speech → text for voice search (Mini App) and voice messages (bot), via Gemini's audio input.
 * Uzbek, Russian and mixed speech are handled by the model; we ask for a verbatim transcript in the
 * language spoken. No key → `available: false` and callers fall back to typing.
 */
import { GoogleGenAI } from "@google/genai";

const realKey = (k: string | undefined) => (k && !k.includes("FAKE") ? k : undefined);
export const transcribeAvailable = () => Boolean(realKey(process.env.GEMINI_API_KEY));
/** Dedicated transcription model first (own quota bucket), then multimodal flash models. */
export const TRANSCRIBE_MODELS: string[] = (process.env.GEMINI_STT_MODELS ?? process.env.GEMINI_STT_MODEL ?? "gemini-3.5-transcribe,gemini-2.5-flash,gemini-3.6-flash,gemini-3.7-flash").split(",").map((m) => m.trim()).filter(Boolean);
export const TRANSCRIBE_MODEL = TRANSCRIBE_MODELS[0];

let client: GoogleGenAI | undefined;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: realKey(process.env.GEMINI_API_KEY), vertexai: process.env.GEMINI_VERTEX === "1", httpOptions: { timeout: 30_000 } }));

const PROMPT =
  "Transcribe this short voice message from a buyer at an Uzbekistan bazaar. It may be in Uzbek (Latin or Cyrillic), Russian, or a mix. " +
  "Return ONLY the transcript text, in the language spoken, using Uzbek Latin script for Uzbek. No quotes, no commentary. If there is no speech, return an empty string.";

export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  let lastErr: unknown;
  for (const model of TRANSCRIBE_MODELS) {
    try {
      const flash = /flash/.test(model);
      const res = await getClient().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
        config: { maxOutputTokens: 200, temperature: 0, ...(flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      });
      // gemini-*-transcribe answers in a dedicated `audioTranscription` part; flash models in plain text
      const parts = (res.candidates?.[0]?.content?.parts ?? []) as { text?: string; audioTranscription?: { text?: string } }[];
      const fromPart = parts.map((p) => p.audioTranscription?.text ?? "").join(" ").trim();
      const text = fromPart || (res.text ?? "");
      return text.trim().replace(/^["'«»]+|["'«»]+$/g, "");
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status === 429 || status === 404 || status === 400) { console.warn(`transcribe: ${model} unavailable (${status}), trying next`); continue; }
      throw e;
    }
  }
  throw lastErr;
}
