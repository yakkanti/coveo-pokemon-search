// Seeds Coveo usage analytics with realistic search traffic so the Query Suggestions (and later ART) models have data.
//
// Drives the deployed app in your installed Google Chrome: types a query, submits it, and sometimes clicks a result,
// exactly like a visitor. Every event goes through the app's own Headless analytics under the PokemonSearch hub.
// Each visitor runs in a fresh browser context, so it gets its own Coveo visitor ID.
//
//   node scripts/seed-traffic.mjs --dry-run              # print the plan, send nothing
//   node scripts/seed-traffic.mjs --visitors 5 --headed  # small, visible test run
//   node scripts/seed-traffic.mjs --visitors 60          # the real run (about 30–40 minutes)
//
// Options: --base <url> (default: the Vercel deploy), --visitors <n> (40), --click-rate <0..1> (0.5), --headed, --dry-run
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = opt("base", "https://reddy-pokemon-search.vercel.app");
const VISITORS = Number(opt("visitors", 40));
const CLICK_RATE = Number(opt("click-rate", 0.5));
const HEADED = args.includes("--headed");
const DRY_RUN = args.includes("--dry-run");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

// Weight = how often a visitor picks the query, roughly how popular it would be on a real Pokémon site.
// Popular names get high weights so the model ranks them first; the long tail shows up once or twice.
const QUERIES = [
  ...weighted(10, ["pikachu", "charizard", "eevee", "mewtwo"]),
  ...weighted(6, ["gengar", "lucario", "bulbasaur", "squirtle", "charmander", "snorlax", "greninja", "umbreon"]),
  ...weighted(4, [
    "rayquaza", "gyarados", "dragonite", "mew", "garchomp", "blastoise", "sylveon", "jigglypuff", "psyduck",
    "magikarp", "arcanine", "ditto", "tyranitar", "mimikyu", "piplup", "togepi", "lugia", "ho-oh",
  ]),
  ...weighted(2, [
    "alakazam", "machamp", "lapras", "vaporeon", "jolteon", "flareon", "espeon", "leafeon", "glaceon",
    "scizor", "metagross", "salamence", "gardevoir", "blaziken", "sceptile", "swampert", "torchic", "mudkip",
    "treecko", "cyndaquil", "totodile", "chikorita", "infernape", "torterra", "empoleon", "zoroark", "hydreigon",
    "volcarona", "aegislash", "decidueye", "incineroar", "primarina", "corviknight", "dragapult", "sprigatito",
    "fuecoco", "quaxly", "koraidon", "miraidon", "pecharunt",
  ]),
  ...weighted(1, [
    "braviary", "oddish", "paras", "tauros", "pinsir", "hitmonlee", "kangaskhan", "porygon", "kabuto",
    "aerodactyl", "articuno", "zapdos", "moltres", "dratini", "celebi", "suicune", "entei", "raikou", "kyogre",
    "groudon", "jirachi", "deoxys", "dialga", "palkia", "giratina", "arceus", "victini", "reshiram", "zekrom",
    "xerneas", "yveltal", "solgaleo", "lunala", "zacian", "zamazenta", "meltan", "wooper", "slowpoke",
  ]),
  ...weighted(4, ["fire type", "water pokemon", "dragon type", "legendary birds", "eevee evolutions"]),
  ...weighted(3, [
    "fire starter", "grass starter", "water starter", "generation 1", "gen 4 starters", "ghost type",
    "psychic pokemon", "mouse pokemon", "electric type", "fairy type", "legendary pokemon",
  ]),
  ...weighted(1, ["steel dragon", "bug type", "ice pokemon", "fighting type", "generation 9", "paradox pokemon"]),
  // A few typos, so Coveo also sees "did you mean" style traffic.
  ...weighted(1, ["pikachoo", "charzard", "evee", "bulbsaur", "mewto"]),
  // Questions also trigger generated answers (each one is an LLM call), so keep these rare.
  ...weighted(1, ["what does charmander evolve into", "which pokemon is the flame pokemon", "is pikachu electric type"]),
];

function weighted(weight, list) {
  return list.flatMap((q) => Array(weight).fill(q));
}

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each visitor runs 2–6 distinct queries, like a short real session.
function planVisitor() {
  const n = Math.floor(rand(2, 7));
  const queries = new Set();
  while (queries.size < n) queries.add(pick(QUERIES));
  return [...queries].map((q) => ({ q, click: Math.random() < CLICK_RATE }));
}

const plan = Array.from({ length: VISITORS }, planVisitor);
const totals = { searches: plan.flat().length, clicks: plan.flat().filter((s) => s.click).length };
console.log(`Plan: ${VISITORS} visitors, ${totals.searches} searches, ${totals.clicks} clicks against ${BASE}`);

if (DRY_RUN) {
  plan.forEach((v, i) => console.log(`  visitor ${i + 1}: ${v.map((s) => s.q + (s.click ? " (+click)" : "")).join(", ")}`));
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: !HEADED });
let done = 0;
let failed = 0;
const events = { search: 0, click: 0, custom: 0 };

try {
  for (const [i, session] of plan.entries()) {
    // A fresh context has empty storage, so Headless creates a new Coveo visitor ID.
    // Headless Chrome announces itself as "HeadlessChrome", which analytics can treat as a bot and drop from
    // model training, so send the regular Chrome user agent instead.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: USER_AGENT });
    const page = await context.newPage();
    // Count the analytics events the app sends, as proof they reach Coveo.
    page.on("request", (req) => {
      const m = /\/rest\/v15\/analytics\/(search|click|custom)/.exec(req.url());
      if (m) events[m[1]]++;
    });
    try {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      const box = page.getByRole("searchbox", { name: "Search Pokémon" });
      const links = page.locator('a[href^="/pokemon/"]');
      // The page runs its own first search on load. Typing before it finishes gets overwritten when it lands.
      const ready = async () => {
        await links.first().waitFor({ timeout: 20000 });
        await sleep(rand(800, 1500));
      };
      await ready();
      for (let { q, click } of session) {
        await box.fill("");
        await box.pressSequentially(q, { delay: rand(60, 160) }); // types like a person, so suggest requests fire too
        await sleep(rand(300, 900));
        if ((await box.inputValue()) !== q) await box.fill(q); // safety net: submit exactly what was planned
        // Wait for this query's search response, not the URL: Coveo may auto-correct a typo ("pikachoo"),
        // so the query in the URL can differ from what was typed.
        const searched = page.waitForResponse(
          (res) =>
            new URL(res.url()).pathname === "/rest/search/v2" &&
            (res.request().postData() ?? "").includes(JSON.stringify(q)),
          { timeout: 15000 },
        );
        await box.press("Enter");
        await searched;
        await sleep(rand(1500, 4000)); // reading the results
        if ((await links.count()) === 0) click = false; // nothing to click for this query

        if (click) {
          // Mostly the top result, sometimes the second or third, like real click behavior.
          const position = Math.random() < 0.7 ? 0 : Math.floor(rand(1, 3));
          const target = links.nth(Math.min(position, (await links.count()) - 1));
          await target.click();
          await page.waitForURL(/\/pokemon\//, { timeout: 15000 });
          await sleep(rand(2000, 5000)); // reading the detail page
          await page.goBack();
          await ready();
        }
        done++;
        await sleep(rand(1000, 3000));
      }
      console.log(`visitor ${i + 1}/${VISITORS}: ${session.map((s) => s.q + (s.click ? "*" : "")).join(", ")}`);
    } catch (e) {
      failed++;
      console.warn(`visitor ${i + 1}/${VISITORS} stopped early: ${e.message.split("\n")[0]}`);
    } finally {
      await sleep(500); // let the click beacon go out before the context closes
      await context.close();
    }
    await sleep(rand(3000, 8000)); // gap between visitors
  }
} finally {
  await browser.close();
}

console.log(`Done: ${done}/${totals.searches} searches completed, ${failed} visitor(s) stopped early.`);
console.log(`Analytics events sent: ${events.search} search, ${events.click} click, ${events.custom} custom.`);
console.log("Next: Coveo → Machine Learning → pokemon-qs → Rebuild.");
