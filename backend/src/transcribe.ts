/**
 * Speech → text for voice search (Mini App) and voice messages (bot), via Gemini's audio input.
 * Uzbek, Russian and mixed speech are handled by the model; we ask for a verbatim transcript in the
 * language spoken. No key → `available: false` and callers fall back to typing.
 */
import { geminiKey, getGeminiClient, withGeminiModels } from "./gemini.js";

export const transcribeAvailable = () => Boolean(geminiKey());
/**
 * Multimodal flash models first: on our Uzbek test clip gemini-3.6-flash returned
 * "Menga besh kg pomidor kerak, Chilonzor" while the dedicated gemini-3.5-transcribe model
 * produced Cyrillic gibberish, so the transcribe model is the last resort (own quota bucket).
 */
export const TRANSCRIBE_MODELS: string[] = (process.env.GEMINI_STT_MODELS ?? process.env.GEMINI_STT_MODEL ?? "gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-transcribe").split(",").map((m) => m.trim()).filter(Boolean);
export const TRANSCRIBE_MODEL = TRANSCRIBE_MODELS[0];

const PROMPT =
  "Transcribe this short voice message from a buyer at an Uzbekistan bazaar. It may be in Uzbek (Latin or Cyrillic), Russian, or a mix. " +
  "Return ONLY the transcript text, in the language spoken, using Uzbek Latin script for Uzbek. No quotes, no commentary. If there is no speech, return an empty string.";

export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  return withGeminiModels("transcribe", TRANSCRIBE_MODELS, async (model, thinking) => {
    const res = await getGeminiClient(30_000).models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
      config: { maxOutputTokens: thinking ? 200 : 800, temperature: 0, ...(thinking ? { thinkingConfig: thinking } : {}) },
    });
    // gemini-*-transcribe answers in a dedicated `audioTranscription` part; flash models in plain text
    const parts = (res.candidates?.[0]?.content?.parts ?? []) as { text?: string; audioTranscription?: { text?: string } }[];
    const fromPart = parts.map((p) => p.audioTranscription?.text ?? "").join(" ").trim();
    const text = fromPart || (res.text ?? "");
    return text.trim().replace(/^["'«»]+|["'«»]+$/g, "");
  });
}
