import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery, toKg, EMPTY, SYSTEM_PROMPT, NLP_MODEL, type MessagesClient } from "./nlp.ts";

/** Fake SDK client: returns the given text, or throws. */
const fake = (reply: string | Error, seen: unknown[] = []): MessagesClient => ({
  messages: {
    create: async (params) => {
      seen.push(params);
      if (reply instanceof Error) throw reply;
      return { content: [{ type: "text", text: reply, citations: null }] } as never;
    },
  },
});

test("sends the spec'd model, max_tokens, system prompt and the raw text unmodified", async () => {
  const seen: any[] = [];
  await parseQuery("  500 kg pomidor kerak, Toshkent ", fake('{"product":"pomidor","quantity":500,"unit":"kg","region":"Toshkent"}', seen));
  assert.equal(seen[0].model, NLP_MODEL);
  assert.equal(seen[0].max_tokens, 200);
  assert.equal(seen[0].system, SYSTEM_PROMPT);
  assert.deepEqual(seen[0].messages, [{ role: "user", content: "500 kg pomidor kerak, Toshkent" }]);
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
  const r2 = await parseQuery("x", fake('{"product":"olma","quantity":-3,"unit":"kg","region":null}'));
  assert.equal(r2.quantity, null);
});

test("garbage response → all nulls, no throw", async () => {
  assert.deepEqual(await parseQuery("x", fake("I could not understand that.")), EMPTY);
  assert.deepEqual(await parseQuery("x", fake('{"product": broken')), EMPTY);
  assert.deepEqual(await parseQuery("x", fake("[1,2,3]")), EMPTY);
});

test("API error → all nulls, no throw", async () => {
  assert.deepEqual(await parseQuery("x", fake(new Error("401 authentication_error"))), EMPTY);
});

test("empty / whitespace input → all nulls without calling the API", async () => {
  const seen: unknown[] = [];
  assert.deepEqual(await parseQuery("", fake("{}", seen)), EMPTY);
  assert.deepEqual(await parseQuery("   \n ", fake("{}", seen)), EMPTY);
  assert.equal(seen.length, 0);
});

test("toKg: weight units normalise, non-weight units return null", () => {
  assert.equal(toKg(500, "kg"), 500);
  assert.equal(toKg(2, "t"), 2000);
  assert.equal(toKg(2, "tonna"), 2000);
  assert.equal(toKg(3, "тонны"), 3000);
  assert.equal(toKg(500, "кг"), 500);
  assert.equal(toKg(500, null), 500);
  assert.equal(toKg(10, "qop"), null);
  assert.equal(toKg(null, "kg"), null);
});
