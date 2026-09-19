/**
 * Relevant product photos: the lead image of each product's English Wikipedia article (canonical,
 * on-topic by definition) plus the first photos used in that article. Writes src/photos.json.
 * Re-run with `--refresh` or with product keys to redo specific ones; hand-edit the JSON to override.
 */
import fs from "node:fs";
import { PRODUCTS } from "../src/products.js";

const ARTICLE: Record<string, string> = {
  tomato: "Tomato", potato: "Potato", onion: "Onion", cucumber: "Cucumber", carrot: "Carrot", cabbage: "Cabbage", pepper: "Bell pepper", eggplant: "Eggplant", garlic: "Garlic",
  apple: "Apple", grape: "Grape", watermelon: "Watermelon", melon: "Cantaloupe", pomegranate: "Pomegranate", peach: "Peach", lemon: "Lemon", banana: "Banana",
  beef: "Beef", lamb: "Lamb and mutton", chicken: "Chicken as food", eggs: "Egg as food", milk: "Milk", qatiq: "Kefir", cheese: "Cheese", butter: "Butter",
  rice: "Rice", flour: "Flour", chickpeas: "Chickpea", sugar: "Sugar", oil: "Sunflower oil", buckwheat: "Buckwheat", cumin: "Cumin", blackpepper: "Black pepper", paprika: "Paprika", dill: "Dill",
  walnut: "Walnut", almond: "Almond", raisins: "Raisin", driedapricot: "Dried apricot", detergent: "Laundry detergent", dishsoap: "Dishwashing liquid", bucket: "Bucket",
  cement: "Cement", brick: "Brick", rebar: "Rebar", plank: "Plank (wood)", cotton: "Cotton", atlas: "Ikat", carpet: "Carpet", charger: "Battery charger", ledlamp: "LED lamp",
  extension: "Power strip", hammer: "Hammer", shovel: "Spade", drill: "Drill",
  // articles whose lead image shows the product as sold, not the plant or its history
  banana: "Cavendish banana", rice: "White rice", sugar: "White sugar", cement: "Portland cement", plank: "Lumber", lemon: "Lemon", melon: "Cantaloupe",
};
/** Where no article lead fits, a Commons search whose result title must contain the word. */
const SEARCH: Record<string, { q: string; must: string[] }> = {
  chickpeas: { q: "chickpeas bowl", must: ["chickpea", "garbanzo"] }, buckwheat: { q: "buckwheat groats", must: ["buckwheat"] }, cumin: { q: "cumin seeds", must: ["cumin"] },
  blackpepper: { q: "black peppercorns", must: ["pepper"] }, paprika: { q: "paprika powder", must: ["paprika"] }, dill: { q: "dill fresh herb", must: ["dill"] },
  detergent: { q: "washing powder detergent", must: ["detergent", "washing", "powder"] }, bucket: { q: "plastic bucket", must: ["bucket", "pail"] }, eggs: { q: "chicken eggs carton", must: ["egg"] },
  drill: { q: "cordless drill", must: ["drill"] }, oil: { q: "sunflower oil bottle", must: ["oil"] }, milk: { q: "glass of milk", must: ["milk"] }, cabbage: { q: "green cabbage head", must: ["cabbage"] },
  onion: { q: "onions bulbs vegetable", must: ["onion"] }, lamb: { q: "lamb chops raw meat", must: ["lamb", "chop"] }, beef: { q: "raw beef meat", must: ["beef"] }, chicken: { q: "raw whole chicken", must: ["chicken"] },
  carrot: { q: "carrots vegetable", must: ["carrot"] }, grape: { q: "vitis vinifera table grapes fruit", must: ["grape", "vitis"] }, banana: { q: "bananas fruit bunch", must: ["banana"] },
  rice: { q: "white rice grains bowl", must: ["rice"] }, sugar: { q: "sugar cubes bowl", must: ["sugar"] }, walnut: { q: "walnuts kernels", must: ["walnut"] }, almond: { q: "almonds nuts", must: ["almond"] },
  rebar: { q: "steel rebar bars", must: ["rebar"] }, ledlamp: { q: "led bulb lamp e27", must: ["led", "bulb"] }, extension: { q: "power strip extension cord", must: ["strip", "extension", "socket"] },
  garlic: { q: "garlic bulbs cloves", must: ["garlic"] }, peach: { q: "peaches fruit", must: ["peach"] }, shovel: { q: "shovel tool", must: ["shovel", "spade"] }, cotton: { q: "cotton fabric textile", must: ["cotton", "fabric"] },
  atlas: { q: "ikat silk textile uzbekistan", must: ["ikat", "atlas", "silk"] },
};
/** never pick these even if the title matches */
const EXCLUDE = /pub|inn\b|hotel|restaurant|street|building|statue|painting|drawing|illustration|botanical|herbarium|map|logo|diagram|sausage|shop|market hall|festival|cake|soup|salad|dish|cooked|roast|grill|\b1[89]\d\d\b/i;
const OUT = new URL("../src/photos.json", import.meta.url);
const out: Record<string, string[]> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const H = { "user-agent": "bozorchi-ai-seed/1.0 (hackathon demo; contact: dev@example.com)", accept: "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: H });
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}
/** Commons thumbnail at 640px for a file title like "File:Carrots.jpg". */
async function thumb(fileTitle: string): Promise<string | null> {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=640`);
  const pg: any = Object.values(j?.query?.pages ?? {})[0];
  const ii = pg?.imageinfo?.[0];
  if (!ii?.thumburl || !/image\/(jpeg|png)/.test(ii.mime ?? "") || (ii.width ?? 0) < 400) return null;
  return ii.thumburl as string;
}
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
for (const p of PRODUCTS) {
  if (only.length && !only.includes(p.key)) continue;
  if (!only.length && out[p.key]?.length >= 1 && !process.argv.includes("--refresh")) continue;
  const article = ARTICLE[p.key] ?? p.label.en;
  const urls: string[] = [];
  if (SEARCH[p.key]) {
    // targeted Commons search; the file title must mention the product
    const { q, must } = SEARCH[p.key];
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=640`);
    const pages: any[] = Object.values(j?.query?.pages ?? {}).sort((a: any, b: any) => a.index - b.index);
    const ok = (pg: any) => { const ii = pg.imageinfo?.[0]; return !!ii?.thumburl && /image\/(jpeg|png)/.test(ii.mime ?? "") && (ii.width ?? 0) >= 500 && (ii.width ?? 0) / (ii.height ?? 1) > 0.7; };
    const good = (pg: any) => ok(pg) && !EXCLUDE.test(pg.title);
    const pick = pages.find((pg) => good(pg) && must.some((w) => pg.title.toLowerCase().includes(w))) ?? pages.find(good) ?? pages.find(ok);
    if (pick) urls.push(pick.imageinfo[0].thumburl);
  } else {
    // the article's lead image — canonical and on-topic
    const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`);
    const lead: string | undefined = summary?.originalimage?.source;
    const leadFile = lead ? decodeURIComponent(lead.split("/").pop()!.split("?")[0]) : null;
    let u = leadFile ? await thumb("File:" + leadFile) : null;
    // files hosted on en.wikipedia (not Commons) aren't found there — scale the summary's own thumbnail instead
    if (!u && summary?.thumbnail?.source) u = String(summary.thumbnail.source).split("?")[0].replace(/\/\d+px-/, "/640px-");
    if (u) urls.push(u);
  }
  out[p.key] = urls;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`${p.key.padEnd(13)} ${urls.length}  ${article}`);
  await sleep(500);
}
console.log("wrote src/photos.json");
