# Tall Grass: Pokémon search on Coveo

Every Pokémon page on [pokemondb.net](https://pokemondb.net) crawled into a Coveo
organization, and searched from a **Next.js 16 + Coveo Headless** app.

**Live demo:** https://reddy-pokemon-search.vercel.app

| Requirement | Where |
|---|---|
| Pokémon pages only, indexed with a Web source and scraping config | [`docs/COVEO_SETUP.md`](docs/COVEO_SETUP.md) §3–4; pipeline filter in §5 |
| Type and Generation facets | `src/components/facet.tsx`, configured in `src/components/search-page.tsx` |
| Pokémon image in each result | `src/components/result-list.tsx` (`pokemon_image` field) |
| Search box with Query Suggestions | `src/components/search-box.tsx` |
| RGA generated answer with citations and feedback | `src/components/generated-answer.tsx` |
| Pokémon detail page (server-rendered Search API query on `@uri`) | `src/app/pokemon/[slug]/page.tsx` |
| Shareable URLs (query and facets in the hash) | `buildUrlManager` in `src/components/search-page.tsx` |
| Clean summary text at indexing time | Indexing pipeline extension, [`docs/ipe/`](docs/ipe/) |
| **Bonus:** "Ask about this Pokémon" with the Passage Retrieval API + Claude | `src/app/api/ask/route.ts`, `src/components/ask-pokemon.tsx` |

## How it works

- **Index.** A Coveo Web source crawls the national Pokédex one level deep, keeping only `/pokedex/<name>` pages.
  A web scraping configuration extracts name, types (multi-value), generation, artwork, national number, species,
  summary and base stats into fields, and excludes site navigation, move tables and location tables so they don't
  pollute relevance.
- **Indexing pipeline extension.** A Python post-conversion extension turns the scraped summary HTML into plain text,
  so the UI, RGA citations and Passage Retrieval all get the same clean text.
- **Query pipeline.** `PokemonSearch`, selected by search hub, with a constant-query filter `@pokemon_generation`
  that keeps only Pokémon pages. The browser's API key is locked to that search hub.
- **App.** The search page is a client component built from Headless controllers (search box, facets, result list,
  generated answer, pager, URL manager). The detail page is a server component: one cached Search API query per
  Pokémon, streamed in with Suspense.

## Ask about this Pokémon (bonus)

Each detail page has a question box. The server route (`/api/ask`) does the retrieval with Coveo and the writing
with Claude:

1. **Passage Retrieval API** (`/rest/search/v3/passages/retrieve`) with `filter: @uri=="<this Pokémon's page>"`,
   so passages come only from this Pokémon's page, under the same `PokemonSearch` hub and pipeline as search.
2. **A Pokédex record** built from the index fields: types, type matchups (`pokemon_weak_to`, `pokemon_resists`,
   `pokemon_immune_to`), base stats and summary. Exact data beats the type chart's abbreviations.
3. **Claude** (`claude-opus-5-5`, low effort) answers from only those documents, with citations on, and the answer
   streams to the page with the sources it cited. Server-side refusal fallback is on (`fallbacks: "default"`).

This is the bring-your-own-LLM pattern: Coveo stays the retrieval and permissions layer, the customer picks the
model. The Anthropic key is server-only (`ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_` prefix). The route caps question
length and rate-limits bursts per IP.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in org ID and a search-only API key, or leave blank for Coveo's sample org
npm run dev
```

Without env vars the app runs against Coveo's public sample org, with `source` and `filetype` standing in for the
Pokémon facets. Detail pages need the Pokémon index.

To set up your own org, follow [`docs/COVEO_SETUP.md`](docs/COVEO_SETUP.md).

## Checks

```bash
npm run lint && npm run typecheck && npm run build
```

Test the indexing extension locally:

```bash
python3 -m venv .venv && .venv/bin/pip install beautifulsoup4 && .venv/bin/python docs/ipe/test_clean_pokemon_summary.py
```

## Deploy

Any Next.js host works. On Vercel, import the repo and set `NEXT_PUBLIC_COVEO_ORG_ID`, `NEXT_PUBLIC_COVEO_API_KEY`
and `NEXT_PUBLIC_COVEO_SEARCH_HUB`. Use an **anonymous search** key restricted to the search hub: it ships to the
browser.

---

Unofficial fan project. Pokémon data and artwork from pokemondb.net. Not affiliated with Nintendo or The Pokémon
Company.
