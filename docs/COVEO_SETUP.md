# Coveo org setup runbook

Everything needed to stand up the Pokémon index in a fresh Coveo organization, in order: fields, sources, scraping
configuration, extension, query pipeline, machine learning models and the API key. It includes the fixes found while
building it, so a new org should take one pass.

Allow about 1 hour of console work, about 40 minutes for the full crawl, and about 1 hour for the models to build.

## 1. Fields (Content → Fields → Add field)

Create these **before** the sources, so the first build populates them.

| Field | Type | Options | Notes |
|---|---|---|---|
| `pokemon_name` | String | Free-text search | Clean name; also mapped onto `title` |
| `pokemon_type` | String | **Facet + Multi-value facet** | Must be multi-value, or dual types become one value |
| `pokemon_generation` | String | **Facet** | Also used by the pipeline filter |
| `pokemon_image` | String | — | Artwork URL |
| `pokemon_number` | **String** | Sortable | Keeps leading zeros (`0025`). Zero-padded, so text sort equals numeric sort |
| `pokemon_dex` | Integer 32 | Sortable | Optional: numeric copy of the number, for ranges and prev/next |
| `pokemon_species` | String | Free-text search | e.g. "Mouse Pokémon" |
| `pokemon_summary` | String | Free-text search | **New:** intro text, replaces the stats-boilerplate excerpt |
| `pokemon_hp`, `pokemon_attack`, `pokemon_defense`, `pokemon_spatk`, `pokemon_spdef`, `pokemon_speed` | Integer 32 | Sortable | **New, optional:** base stats for the detail page |
| `pokemon_weak_to`, `pokemon_resists`, `pokemon_immune_to` | String | **Facet + Multi-value facet** | Attacking types from the type chart, e.g. Gyarados is weak to `Electric; Rock`. Cleaned by the extension (§4a) |

A field's type can't be changed later. Delete and recreate the field if a type is wrong.

## 2. Test source: `pokemon-single`

Content → Sources → Add source → **Web**.

1. **Starting URL:** `https://pokemondb.net/pokedex/charizard`. Charizard has Mega forms, so it tests the selectors
   against the hard case.
2. **Content security: Everyone.** This was the cause of "0 results" in the first org: an anonymous search key can't
   see items limited to specific users.
3. **Crawling rules:** keep "Include all non-excluded pages". Under advanced settings, set **Number of page levels to
   crawl from a starting URL** to `0`.
4. **Web scraping:** edit the default configuration in **Edit with JSON** mode and add the `metadata` block from §4.
5. **Mappings:** either set `"performFieldMappingUsingAllOrigins": true` in the source JSON configuration, or map
   each field to `%[<same name>]` under **View and map metadata**. Automatic mapping is **off by default** on Web sources.
   Either way, also map **`title` → `%[pokemon_name]`**, and `pokemon_dex` → `%[pokemon_number]` if you created it.
6. Save and rebuild, then check the item in the Content Browser (§6).

## 3. Full source: `pokemon-all`

The quickest way is **Duplicate** on `pokemon-single`: it copies the scraping configuration, mappings and
extension. Then change the settings below.

1. **Starting URL:** `https://pokemondb.net/pokedex/national`
2. **Content security: Everyone**
3. **Number of page levels to crawl:** `1`. Every Pokémon is one link from the national list.
4. **Inclusion:** "matches regex rule": `^https://pokemondb\.net/pokedex/[a-z0-9-]+$`
5. **Exclusion:** "is": `https://pokemondb.net/pokedex/all`. Don't exclude the starting page; the pipeline filter
   removes it from results.
6. **Time the crawler waits between requests:** `2000` ms, which matches the robots.txt `Crawl-delay: 2`.
7. The same scraping configuration (§4), mappings (including `title` → `%[pokemon_name]`) and extension (§4a) as
   the test source. Check all three: a source created from scratch has none of them.
8. Rebuild. Expect **1,026 items**: 1,025 Pokémon plus the national page. The pipeline filter (§5) hides the national
   page from results, and the model dataset filter (§5a) keeps it out of the models, so both work with 1,025.

When you're done testing, **delete `pokemon-single`**, otherwise Charizard shows up twice.

## 4. Web scraping metadata

The selectors were checked against the live Bulbasaur and Charizard pages. They're scoped to the **first** vitals
and stats tables, because Mega and alternate forms repeat those tables in other tabs.

```json
"metadata": {
  "pokemon_name":       { "type": "CSS",   "path": "h1::text" },
  "pokemon_type":      { "type": "XPATH", "path": "(//table[contains(@class,'vitals-table')])[1]//tr[th='Type']/td/a/text()" },
  "pokemon_generation": { "type": "XPATH", "path": "(//p[contains(.,'introduced in')]/abbr)[1]/text()" },
  "pokemon_image":      { "type": "CSS",   "path": "meta[property='og:image']::attr(content)" },
  "pokemon_number":        { "type": "XPATH", "path": "(//table[contains(@class,'vitals-table')])[1]//tr[starts-with(normalize-space(th),'National')]/td/strong/text()" },
  "pokemon_species":    { "type": "XPATH", "path": "(//table[contains(@class,'vitals-table')])[1]//tr[th='Species']/td/text()" },
  "pokemon_summary":    { "type": "XPATH", "path": "(//div[@id='dex-basics']/preceding-sibling::p)[position() <= 2]" },
  "pokemon_hp":         { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='HP']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_attack":     { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='Attack']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_defense":    { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='Defense']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_spatk":      { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='Sp. Atk']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_spdef":      { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='Sp. Def']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_speed":      { "type": "XPATH", "path": "(//h2[text()='Base stats'])[1]/following::table[1]//tr[th='Speed']/td[contains(@class,'cell-num')][1]/text()" },
  "pokemon_weak_to":    { "type": "XPATH", "path": "(//h2[text()='Type defenses'])[1]/following-sibling::div[contains(@class,'resp-scroll')][1]//td[contains(@title,'= super-effective')]/@title" },
  "pokemon_resists":    { "type": "XPATH", "path": "(//h2[text()='Type defenses'])[1]/following-sibling::div[contains(@class,'resp-scroll')][1]//td[contains(@title,'= not very effective')]/@title" },
  "pokemon_immune_to":  { "type": "XPATH", "path": "(//h2[text()='Type defenses'])[1]/following-sibling::div[contains(@class,'resp-scroll')][1]//td[contains(@title,'= no effect')]/@title" }
}
```

Known pitfalls:
- **`№` character:** the page writes it as `&#8470;`, and an exact match on `th='National №'` failed in Coveo. The
  `starts-with(normalize-space(th),'National')` selector avoids that character.
- **Type icons:** they also appear in the type-defenses chart. The vitals-table scoping prevents bogus types.
- **Type chart as text is unreadable.** The type-defenses table uses abbreviated headers and symbols, so it indexes
  as `NorFirWatEle… ½½4½0` and RGA guesses wrong (it said Gyarados is weak to Dragon, Fairy and Ice). The real
  meaning is in each cell's tooltip (`Electric → Water/Flying = super-effective`), which the three `pokemon_weak_to`,
  `pokemon_resists` and `pokemon_immune_to` selectors read. They're scoped to the first chart, the base form.
- **`pokemon_summary` is stored as HTML.** The selector returns `<p>` elements, and Coveo joins them with `;`.
  The extension in §4a turns it into plain text.

### Exclusions (required)

Add this `exclude` list next to `metadata` in the same scraping configuration entry. Without it, "pikachu" and
"eevee" match about 810 pages: the site menu links to "Let's Go Pikachu & Let's Go Eevee" on every page, and every
"Where to find" table has rows for those games. The move tables and neighbor links also add noise to excerpts,
ranking and generated answers.

```json
"exclude": [
  { "type": "CSS",   "path": "header" },
  { "type": "CSS",   "path": "nav" },
  { "type": "CSS",   "path": "footer" },
  { "type": "CSS",   "path": "a.sr-only" },
  { "type": "CSS",   "path": "ul.list-nav" },
  { "type": "XPATH", "path": "//main/*[preceding-sibling::div[@id='dex-moves']]" }
]
```

- `nav` also removes the previous/next Pokémon links at the top and bottom of each page.
- `a.sr-only` (the "Skip to main content" link) and `ul.list-nav` (the Contents list) otherwise open every
  Passage Retrieval passage, wasting passage space on page chrome.
- **The `#dex-*` ids are empty anchors** (`<div id="dex-moves"></div>`), not containers, so excluding them by CSS
  removes nothing. The page sections are flat siblings under `<main>`. The XPath rule removes every sibling after
  the moves anchor: moves, sprites, locations, the Q&A box and other languages.
- What stays: the intro, Pokédex data, base stats, type defenses, evolution chart, changes and Pokédex entries. All
  the field selectors read from those sections. Gen 1 pages still mention Let's Go Pikachu/Eevee in their Pokédex
  data and entries, which is genuine.

## 4a. Indexing pipeline extension: clean `pokemon_summary` and the type matchups

The script is [`docs/ipe/clean_pokemon_summary.py`](ipe/clean_pokemon_summary.py). It runs on each item at
indexing time, strips the tags from `pokemon_summary` with BeautifulSoup (available in Coveo's extension runtime),
and writes plain text back, with one blank line between paragraphs. It also trims the type-chart tooltips in
`pokemon_weak_to`, `pokemon_resists` and `pokemon_immune_to` (`Electric → Water/Flying = super-effective`) down to the
attacking type (`Electric`). Cleaning once at ingestion means the UI, RGA citations and any Passage Retrieval client
all get the same clean text.

1. **Content → Extensions → Add extension.** Name: `clean-pokemon-summary`. Paste the script and save.
2. **Content → Sources →** each Pokémon source → **More → Manage extensions** (the label may read "Edit
   extensions") → **Add**. Pick `clean-pokemon-summary`, stage **Post-conversion**, apply to **all items**.
   - Use post-conversion because the scraped metadata has already been mapped by then, and the value written back
     goes straight into the `pokemon_summary` field, which has the same name.
3. **Rebuild** the source. Extensions only run when items are indexed.
4. **Check:** in the Content Browser, Charizard's `pokemon_summary` should start "Charizard is a Fire/Flying type
   Pokémon…" with no tags, and Gyarados' `pokemon_weak_to` should be `Electric; Rock`. For each item, the Log Browser
   shows `pokemon_summary: cleaned 2 paragraph(s)`. The
   extension's **Usage statistics** show executions and errors.

Local test, run before pasting into Coveo (a stand-in `document` object, the real Charizard markup):
```bash
python3 -m venv .venv && .venv/bin/pip install beautifulsoup4 && .venv/bin/python docs/ipe/test_clean_pokemon_summary.py
```

The app's `plainText()` stays in place as a fallback, so the UI is clean either way.

## 5. Query pipeline

Search → Query Pipelines → **Add pipeline** `PokemonSearch`.

1. **Condition:** Search hub is `PokemonSearch`. The app sends this search hub on every query.
2. **Filter rule:** Query parameter **cq (constant query)**, **Advanced mode**, expression `@pokemon_generation`.
   This keeps only Pokémon pages, which drops the national list page. Basic mode can't express "field has any value".
3. **Models:** associate the Query Suggestions, Semantic Encoder, RGA and Passage Retrieval models with this pipeline
   (§5a).

## 5a. Machine learning models

Machine Learning → Models → **Add model**, then associate each one with the `PokemonSearch` pipeline (pipeline →
Machine Learning tab → Associate model).

| Model | Name | Learns from | Association condition |
|---|---|---|---|
| Query Suggestions | `pokemon-qs` | Usage analytics (searches, clicks) | Search Hub is PokemonSearch |
| Semantic Encoder | `pokemon-se` | Source `pokemon-all` | Search Hub is PokemonSearch **AND** Context `semantic` is not `off` |
| Relevance Generative Answering | `pokemon-rga` | Source `pokemon-all` | Search Hub is PokemonSearch |
| Passage Retrieval (CPR) | `pokemon-cpr` | Source `pokemon-all` | Search Hub is PokemonSearch |

- **Dataset filter** on the three content models (Semantic Encoder, RGA, Passage Retrieval): Configuration → Learn
  from → **Add filter**, `@pokemon_generation`, then **Apply**. The data volume preview should drop from 1,026 to
  **1,025** candidates, so the national list page never reaches answers or passages.
- **Semantic Encoder condition:** the second condition lets a single request turn hybrid retrieval off by sending
  `context: { "semantic": "off" }`. Normal traffic doesn't send it, so it keeps the encoder. The app exposes this as
  `?semantic=off`, and `npm run compare-semantic` measures both modes (§8).
- **Query Suggestions** learns only from real searches, so a new org has 0 candidates and the status shows
  "Limited". Seed it with `npm run seed-traffic -- --visitors 60` (scripted visits to the live site, clearly
  labeled), wait for the analytics to process, then rebuild the model.
- **RGA** needs Headless in `analyticsMode: "legacy"`, which the app already sets.
- **Rebuilding:** there's no schedule setting on the content models. Open the model → Configuration → change
  something (the dataset filter is a good one) → **Save** starts a build. Avoid rebuilding right before a demo.

## 6. Verify

- **Content Browser:** open Charizard. Expected values: types `Fire; Flying` (2 values), generation `Generation 1`,
  `pokemon_number` `0006`, title `Charizard`, the image URL, the summary text, and HP `78`.
- **Search API**, using the app's key:
  ```bash
  curl -s "https://$ORG_ID.org.coveo.com/rest/search/v2" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"q":"","searchHub":"PokemonSearch","numberOfResults":0,"facets":[{"field":"pokemon_type","type":"specific","numberOfValues":20}]}'
  ```
  Expect `totalCount` 1025 once the pipeline filter is on, and 18 type values. The request must be a POST with
  `Content-Type: application/json`; sent any other way, Coveo ignores the body and returns all 1,025 items.
- **Query Suggestions:** `POST …/rest/search/v2/querySuggest` with `{"q":"char","searchHub":"PokemonSearch"}`
  should suggest charizard and charmander once the model has candidates.
- **Semantic Encoder:** `{"q":"giant sea serpent"}` returns about 31 results with Gyarados first; adding
  `"context":{"semantic":"off"}` returns none.
- **RGA:** in the app, "What does Charmander evolve into?" answers "Charmeleon at Level 16", with Charmander and
  Charmeleon cited.
- **Passage Retrieval:** `POST …/rest/search/v3/passages/retrieve` with `query`, `searchHub`, `maxPassages` and the
  required `localization` (`{"locale":"en-US","timezone":"UTC"}`). Add `"filter": "@uri==\"https://pokemondb.net/pokedex/gyarados\""`
  to scope passages to one Pokémon. Passages should start with the Pokémon's intro, not the site header.

## 7. API key and app

1. Organization → API Keys → **Anonymous search** template, restricted to search hub `PokemonSearch`. That key is
   safe to ship in the browser. The hub dropdown only lists hubs Coveo has already seen, so run a few searches from
   the app first. Once locked, every query uses the `PokemonSearch` pipeline, whatever hub the client sends.
2. Update `.env.local`, and later the hosting env vars:
   ```
   NEXT_PUBLIC_COVEO_ORG_ID=<new org id>
   NEXT_PUBLIC_COVEO_API_KEY=<new search key>
   NEXT_PUBLIC_COVEO_SEARCH_HUB=PokemonSearch
   ```
3. Restart `npm run dev`. No code changes are needed.

## 8. After changing the source or scraping configuration

Models keep the content they were built from. After any change to the scraping configuration, exclusions or the
extension, the RGA chunks and Passage Retrieval passages stay stale (for example, still containing "Skip to main
content") until the models are rebuilt.

1. **Rebuild the source** and wait until it's idle.
2. **Rebuild the content models**, in this order: Semantic Encoder, then RGA and Passage Retrieval. Query
   Suggestions doesn't need it; it learns from searches, not page content.
3. **Check relevance:** `npm run compare-semantic` runs 17 test queries with the Semantic Encoder on and off and
   prints the mean reciprocal rank by query kind. The last run gave 0.83 with the encoder and 0.57 without.
4. **Check the answers:** rerun the RGA and Ask questions from §6.

For the deployed app, `ANTHROPIC_API_KEY` must also be set in the hosting environment (server-only, no
`NEXT_PUBLIC_` prefix) for the "Ask about this Pokémon" feature.
