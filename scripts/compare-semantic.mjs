// Side-by-side relevance check: the same queries under two request contexts, A and B.
//
// Pipeline rules can be conditioned on a context value, so one request can switch a rule or model on or off
// while everything else stays identical:
//   - the Semantic Encoder association: Context[semantic] is not "off"
//   - the tuned ranking weights rule:   Context[weights] is "tuned"
//
//   npm run compare-semantic                                   # A = default, B = semantic=off
//   npm run compare-semantic -- --top 5                        # also print each query's top results
//   npm run compare-semantic -- --b weights=tuned              # default vs tuned ranking weights
//   npm run compare-semantic -- --a semantic=off --b semantic=off,weights=tuned   # same, keyword-only
//
// Each query has the Pokémon a good result list should rank highly. "Best rank" is the position of the first
// of them in the top 10 (lower is better); "hit@3" counts how many expected Pokémon land in the top 3.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const ORG = env.NEXT_PUBLIC_COVEO_ORG_ID;
const KEY = env.NEXT_PUBLIC_COVEO_API_KEY;
const HUB = env.NEXT_PUBLIC_COVEO_SEARCH_HUB || "PokemonSearch";
const contextArg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  const raw = i === -1 ? fallback : process.argv[i + 1] ?? "";
  return Object.fromEntries(raw.split(",").filter(Boolean).map((kv) => kv.split("=")));
};
const CTX_A = contextArg("--a", "");
const CTX_B = contextArg("--b", "semantic=off");
const label = (ctx) => (Object.keys(ctx).length ? Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(",") : "default");
const SHOW_TOP = (() => {
  const i = process.argv.indexOf("--top");
  return i === -1 ? 0 : Number(process.argv[i + 1] ?? 5);
})();

const STARTERS_FIRE = ["Charmander", "Cyndaquil", "Torchic", "Chimchar", "Tepig", "Fennekin", "Litten", "Scorbunny", "Fuecoco"];
const EEVEELUTIONS = ["Eevee", "Vaporeon", "Jolteon", "Flareon", "Espeon", "Umbreon", "Leafeon", "Glaceon", "Sylveon"];

// [query, kind, expected Pokémon]
const QUERIES = [
  ["pikachu", "exact name", ["Pikachu"]],
  ["charizard", "exact name", ["Charizard"]],
  ["gyarados", "exact name", ["Gyarados"]],
  ["pikachoo", "typo", ["Pikachu"]],
  ["charzard", "typo", ["Charizard"]],
  ["bulbsaur", "typo", ["Bulbasaur"]],
  ["mouse pokemon", "descriptive", ["Pikachu", "Raichu", "Rattata", "Raticate", "Pawmi", "Pawmo", "Pawmot", "Sandshrew"]],
  ["electric mouse", "descriptive", ["Pikachu", "Raichu", "Pawmi", "Pawmo", "Pachirisu", "Dedenne", "Togedemaru", "Morpeko", "Emolga"]],
  ["fire starter", "descriptive", STARTERS_FIRE],
  ["legendary bird", "descriptive", ["Articuno", "Zapdos", "Moltres", "Ho-Oh", "Lugia"]],
  ["sleeping pokemon", "descriptive", ["Snorlax", "Munchlax", "Komala", "Drowzee"]],
  ["eevee evolutions", "descriptive", EEVEELUTIONS],
  ["ghost type", "attribute", ["Gengar", "Haunter", "Gastly", "Mimikyu", "Dragapult", "Chandelure", "Misdreavus"]],
  ["giant sea serpent", "conceptual", ["Gyarados", "Milotic", "Dhelmise", "Eelektross"]],
  ["fish that evolves into a dragon", "conceptual", ["Magikarp", "Gyarados", "Feebas", "Milotic"]],
  ["which pokemon can breathe fire and fly", "question", ["Charizard", "Moltres", "Ho-Oh", "Talonflame", "Salamence"]],
  ["what does charmander evolve into", "question", ["Charmeleon", "Charmander", "Charizard"]],
];

async function search(q, context) {
  const res = await fetch(`https://${ORG}.org.coveo.com/rest/search/v2`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      q,
      searchHub: HUB,
      numberOfResults: 10,
      maximumAge: 0,
      fieldsToInclude: ["pokemon_name"],
      ...(Object.keys(context).length ? { context } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Search API ${res.status} for "${q}"`);
  const data = await res.json();
  return { total: data.totalCount, names: data.results.map((r) => r.raw.pokemon_name ?? r.title) };
}

const bestRank = (names, expected) => {
  const i = names.findIndex((n) => expected.includes(n));
  return i === -1 ? null : i + 1;
};
const hitsAt3 = (names, expected) => names.slice(0, 3).filter((n) => expected.includes(n)).length;
const overlap = (a, b) => a.filter((n) => b.includes(n)).length;
const pad = (s, n) => String(s).padEnd(n);
const fmtRank = (r) => (r === null ? "–" : String(r));

const rows = [];
for (const [q, kind, expected] of QUERIES) {
  const [on, off] = await Promise.all([search(q, CTX_A), search(q, CTX_B)]);
  rows.push({ q, kind, expected, on, off, rOn: bestRank(on.names, expected), rOff: bestRank(off.names, expected) });
}

console.log(`\nA = ${label(CTX_A)}  vs  B = ${label(CTX_B)} · hub ${HUB} · top 10 per query\n`);
console.log(
  pad("query", 40) + pad("kind", 13) + pad("count A/B", 15) + pad("best rank A/B", 18) + pad("hit@3 A/B", 14) + "top-10 overlap",
);
for (const r of rows) {
  const verdict = r.rOn === r.rOff ? "" : (r.rOn ?? 99) < (r.rOff ?? 99) ? "  ← A better" : "  ← B better";
  console.log(
    pad(r.q, 40) +
      pad(r.kind, 13) +
      pad(`${r.on.total} / ${r.off.total}`, 15) +
      pad(`${fmtRank(r.rOn)} / ${fmtRank(r.rOff)}`, 18) +
      pad(`${hitsAt3(r.on.names, r.expected)} / ${hitsAt3(r.off.names, r.expected)}`, 14) +
      `${overlap(r.on.names, r.off.names)}/10` +
      verdict,
  );
}

// Summary by query kind: mean reciprocal rank of the first expected Pokémon (1.0 = always first).
const mrr = (list, key) => list.reduce((s, r) => s + (r[key] ? 1 / r[key] : 0), 0) / list.length;
console.log("\nMRR by query kind (higher is better):");
for (const kind of [...new Set(rows.map((r) => r.kind))]) {
  const list = rows.filter((r) => r.kind === kind);
  console.log(`  ${pad(kind, 13)} A ${mrr(list, "rOn").toFixed(2)}   B ${mrr(list, "rOff").toFixed(2)}   (${list.length} queries)`);
}
console.log(`  ${pad("all", 13)} A ${mrr(rows, "rOn").toFixed(2)}   B ${mrr(rows, "rOff").toFixed(2)}`);

if (SHOW_TOP) {
  for (const r of rows) {
    console.log(`\n"${r.q}"`);
    for (let i = 0; i < SHOW_TOP; i++) {
      const a = r.on.names[i] ?? "", b = r.off.names[i] ?? "";
      const mark = (n) => (r.expected.includes(n) ? "*" : " ");
      console.log(`  ${i + 1}. ${mark(a)}${pad(a, 22)} ${mark(b)}${b}`);
    }
  }
  console.log(`\n(* = expected Pokémon; left = A ${label(CTX_A)}, right = B ${label(CTX_B)})`);
}
