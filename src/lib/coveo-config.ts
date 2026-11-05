import { getSampleSearchEngineConfiguration, type SearchEngineConfiguration } from "@coveo/headless";

// Everything the app needs from the Coveo org comes from env vars. Without them the app runs against
// Coveo's public sample org, so the UI can be built before the Pokémon source finishes crawling.
const orgId = process.env.NEXT_PUBLIC_COVEO_ORG_ID;
const apiKey = process.env.NEXT_PUBLIC_COVEO_API_KEY;

export const isSampleOrg = !orgId || !apiKey;

export const searchHub = process.env.NEXT_PUBLIC_COVEO_SEARCH_HUB ?? "PokemonSearch";

// The sample org has no Pokémon fields, so fall back to fields it does have.
export const fields = isSampleOrg
  ? { name: "", types: "source", generation: "filetype", image: "", number: "", species: "", summary: "" }
  : {
      name: "pokemon_name",
      types: "pokemon_type",
      generation: "pokemon_generation",
      image: "pokemon_image",
      number: "pokemon_number",
      species: "pokemon_species",
      summary: "pokemon_summary",
    };

export const fieldsToInclude = Object.values(fields).filter(Boolean);

export function searchEngineConfiguration(): SearchEngineConfiguration {
  if (!orgId || !apiKey) return getSampleSearchEngineConfiguration();
  return {
    organizationId: orgId,
    accessToken: apiKey,
    search: { searchHub },
    // Headless warns that the generated answer (RGA) controller needs the legacy analytics mode.
    analytics: { analyticsMode: "legacy", originLevel2: "default" },
  };
}

export function searchApiUrl(): string {
  const { organizationId } = searchEngineConfiguration();
  return `https://${organizationId}.org.coveo.com/rest/search/v2`;
}

// pokemondb.net/pokedex/<slug> → <slug>, so results can link to the in-app detail page.
export function pokemonSlug(uri: string): string | null {
  const match = /^https:\/\/pokemondb\.net\/pokedex\/([a-z0-9-]+)$/.exec(uri);
  return match ? match[1] : null;
}

// pokemon_summary is scraped as <p> elements, so it arrives as HTML. Render it as plain text.
export function plainText(html: string): string {
  return html
    // Coveo joins the scraped paragraphs with ";" when it stores them.
    .replace(/<\/p>\s*;?\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}
