/**
 * Manual check of the LLM parser against realistic messy inputs.
 * Needs ANTHROPIC_API_KEY in backend/.env.   Run:  npm run nlp:check --workspace backend
 */
import "dotenv/config";
import { nlpAvailable, parseQuery, selectProviderName, toKg, GEMINI_MODEL, ANTHROPIC_MODEL } from "../src/nlp.js";

const INPUTS = [
  "500 kg pomidor kerak, Toshkent",
  "menga span piyoz kerakk tezroq",
  "assalomu alaykum menga bugun ertalab срочно нужно примерно две тонны картошка yunusobodga olib kelib bersangiz bo'ladimi narxi qancha",
  "",
  "asdkjh qwe 123 ???",
];

if (!nlpAvailable()) {
  console.error("Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is set in backend/.env — nothing to test.");
  process.exit(1);
}
const prov = selectProviderName();
console.log(`provider: ${prov} · model: ${prov === "gemini" ? GEMINI_MODEL : ANTHROPIC_MODEL}`);
for (const [i, input] of INPUTS.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 4000)); // free-tier rate limits are tight
  const t0 = Date.now();
  const r = await parseQuery(input);
  console.log(`\n> ${JSON.stringify(input)}   (${Date.now() - t0} ms)`);
  console.log(`  product=${r.product}  quantity=${r.quantity} ${r.unit ?? ""}  → ${toKg(r.quantity, r.unit) ?? "—"} kg  region=${r.region}`);
}
