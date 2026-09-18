/**
 * Voice → text. Optional: only active when OPENAI_API_KEY is set (Whisper via plain fetch,
 * no SDK). Without it the bot politely asks the user to type. Swap the provider here if the
 * team picks something else.
 */
export function sttAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribe(audio: Buffer, filename = "voice.ogg"): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/ogg" }), filename);
  form.append("model", process.env.STT_MODEL ?? "whisper-1");
  form.append("prompt", "pomidor, kartoshka, piyoz, Toshkent, Chilonzor, Yunusobod");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`STT failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return json.text.trim();
}
