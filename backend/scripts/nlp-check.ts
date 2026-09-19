/**
 * Manual check of the LLM parser against realistic messy inputs.
 * Needs ANTHROPIC_API_KEY in backend/.env.   Run:  npm run nlp:check --workspace backend
 */
import "dotenv/config";
import { nlpAvailable, parseQuery, toKg } from "../src/nlp.js";

const INPUTS = [
  "500 kg pomidor kerak, Toshkent",
  "menga span piyoz kerakk tezroq",
  "assalomu alaykum menga bugun ertalab срочно нужно примерно две тонны картошка yunusobodga olib kelib bersangiz bo'ladimi narxi qancha",
  "",
  "asdkjh qwe 123 ???",
];

if (!nlpAvailable()) {
  console.error("ANTHROPIC_API_KEY is not set in backend/.env — nothing to test.");
  process.exit(1);
}
for (const input of INPUTS) {
  const t0 = Date.now();
  const r = await parseQuery(input);
  console.log(`\n> ${JSON.stringify(input)}   (${Date.now() - t0} ms)`);
  console.log(`  product=${r.product}  quantity=${r.quantity} ${r.unit ?? ""}  → ${toKg(r.quantity, r.unit) ?? "—"} kg  region=${r.region}`);
}
