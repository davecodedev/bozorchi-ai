import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseQuery, toKg, EMPTY, SYSTEM_PROMPT, ANTHROPIC_MODEL, GEMINI_MODEL, NLP_MAX_TOKENS,
  anthropicProvider, geminiProvider, selectProviderName, type MessagesClient, type GenAIClient, type Provider,
} from "./nlp.ts";

/** Fake provider: returns the given text, or throws. */
const fake = (reply: string | Error): Provider => ({ name: "gemini", call: async () => { if (reply instanceof Error) throw reply; return reply; } });

test("anthropic provider sends the spec'd model, max_tokens, system prompt and the raw text unmodified", async () => {
  const seen: any[] = [];
  const client: MessagesClient = { messages: { create: async (p) => { seen.push(p); return { content: [{ type: "text", text: '{"product":"pomidor"}' }] } as never; } } };
  const r = await parseQuery("  500 kg pomidor kerak, Toshkent ", anthropicProvider(client));
  assert.equal(seen[0].model, ANTHROPIC_MODEL);
  assert.equal(seen[0].max_tokens, 200);
  assert.equal(seen[0].system, SYSTEM_PROMPT);
  assert.deepEqual(seen[0].messages, [{ role: "user", content: "500 kg pomidor kerak, Toshkent" }]);
  assert.equal(r.product, "pomidor");
});

test("gemini provider sends model, system instruction, JSON mime type, token cap and raw text", async () => {
  const seen: any[] = [];
  const client: GenAIClient = { models: { generateContent: async (p) => { seen.push(p); return { text: '{"product":"piyoz","quantity":2,"unit":"t","region":null}' }; } } };
  const r = await parseQuery("2 tonna piyoz", geminiProvider(client));
  assert.equal(seen[0].model, GEMINI_MODEL);
  assert.equal(seen[0].contents, "2 tonna piyoz");
  assert.equal(seen[0].config.systemInstruction, SYSTEM_PROMPT);
  assert.equal(seen[0].config.maxOutputTokens, NLP_MAX_TOKENS);
  assert.equal(seen[0].config.responseMimeType, "application/json");
  assert.deepEqual(r, { product: "piyoz", quantity: 2, unit: "t", region: null });
});

test("clean JSON → typed result", async () => {
  const r = await parseQuery("x", fake('{"product":"pomidor","quantity":500,"unit":"kg","region":"Toshkent"}'));
  assert.deepEqual(r, { product: "pomidor", quantity: 500, unit: "kg", region: "Toshkent" });
});

test("tolerates markdown fences and chatter around the JSON", async () => {
  const r = await parseQuery("x", fake('Sure! ```json\n{"product":"piyoz","quantity":null,"unit":null,"region":null}\n```'));
  assert.deepEqual(r, { product: "piyoz", quantity: null, unit: null, region: null });
});

test("coerces sloppy types: numeric strings, blank strings, negative numbers", async () => {
  const r = await parseQuery("x", fake('{"product":"  ","quantity":"2,5","unit":"T","region":""}'));
  assert.deepEqual(r, { product: null, quantity: 2.5, unit: "t", region: null });
  assert.equal((await parseQuery("x", fake('{"product":"olma","quantity":-3,"unit":"kg","region":null}'))).quantity, null);
});

test("garbage response → all nulls, no throw", async () => {
  assert.deepEqual(await parseQuery("x", fake("I could not understand that.")), EMPTY);
  assert.deepEqual(await parseQuery("x", fake('{"product": broken')), EMPTY);
  assert.deepEqual(await parseQuery("x", fake("[1,2,3]")), EMPTY);
  assert.deepEqual(await parseQuery("x", fake("")), EMPTY);
});

test("API error → all nulls, no throw", async () => {
  assert.deepEqual(await parseQuery("x", fake(new Error("400 credit balance too low"))), EMPTY);
});

test("empty input or no provider → all nulls without calling anything", async () => {
  let calls = 0;
  const p: Provider = { name: "gemini", call: async () => { calls++; return "{}"; } };
  assert.deepEqual(await parseQuery("", p), EMPTY);
  assert.deepEqual(await parseQuery("   \n ", p), EMPTY);
  assert.deepEqual(await parseQuery("pomidor", null), EMPTY);
  assert.equal(calls, 0);
});

test("provider selection from env", () => {
  const env = { ...process.env };
  const set = (o: Record<string, string | undefined>) => { for (const k of ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "NLP_PROVIDER"]) delete process.env[k]; Object.assign(process.env, o); };
  set({}); assert.equal(selectProviderName(), null);
  set({ GEMINI_API_KEY: "sk-FAKE" }); assert.equal(selectProviderName(), null);
  set({ GEMINI_API_KEY: "AQ.real" }); assert.equal(selectProviderName(), "gemini");
  set({ ANTHROPIC_API_KEY: "sk-ant-real" }); assert.equal(selectProviderName(), "anthropic");
  set({ GEMINI_API_KEY: "AQ.real", ANTHROPIC_API_KEY: "sk-ant-real" }); assert.equal(selectProviderName(), "gemini");
  set({ GEMINI_API_KEY: "AQ.real", ANTHROPIC_API_KEY: "sk-ant-real", NLP_PROVIDER: "anthropic" }); assert.equal(selectProviderName(), "anthropic");
  set({ ANTHROPIC_API_KEY: "sk-ant-real", NLP_PROVIDER: "gemini" }); assert.equal(selectProviderName(), "anthropic"); // preferred key missing → fall back
  process.env = env;
});

test("toKg: weight units normalise, non-weight units return null", () => {
  assert.equal(toKg(500, "kg"), 500);
  assert.equal(toKg(2, "t"), 2000);
  assert.equal(toKg(3, "тонны"), 3000);
  assert.equal(toKg(500, null), 500);
  assert.equal(toKg(10, "qop"), null);
  assert.equal(toKg(null, "kg"), null);
});
