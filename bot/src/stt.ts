/**
 * Voice → text for the bot. Goes through the backend's /transcribe (Gemini audio: Uzbek, Russian,
 * mixed). Without a key the backend reports unavailable and the bot asks the user to type.
 */
export async function sttAvailable(backendUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${backendUrl}/transcribe`, { signal: AbortSignal.timeout(4000) });
    return r.ok && Boolean(((await r.json()) as { available?: boolean }).available);
  } catch {
    return false;
  }
}

export async function transcribe(backendUrl: string, audio: Buffer, mimeType = "audio/ogg"): Promise<string> {
  const res = await fetch(`${backendUrl}/transcribe`, {
    method: "POST",
    headers: { "content-type": mimeType },
    body: new Uint8Array(audio),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`STT failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return (json.text ?? "").trim();
}
