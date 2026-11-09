import { cacheLife } from "next/cache";
import {
  fieldsToInclude,
  isSampleOrg,
  searchApiUrl,
  searchEngineConfiguration,
  searchHub,
} from "@/lib/coveo-config";

export interface SearchApiResult {
  title: string;
  clickUri: string;
  excerpt: string;
  raw: Record<string, unknown>;
}

// Type matchups and base stats, scraped from the type chart and stats table. Only the detail page and the
// Ask feature need them, so they aren't requested on every search.
export const matchupFields = {
  weakTo: "pokemon_weak_to",
  resists: "pokemon_resists",
  immuneTo: "pokemon_immune_to",
};
export const statFields = {
  HP: "pokemon_hp",
  Attack: "pokemon_attack",
  Defense: "pokemon_defense",
  "Sp. Atk": "pokemon_spatk",
  "Sp. Def": "pokemon_spdef",
  Speed: "pokemon_speed",
};

export const isValidSlug = (slug: string) => /^[a-z0-9-]{1,40}$/.test(slug);

export const pokemonUri = (slug: string) => `https://pokemondb.net/pokedex/${slug}`;

// One Pokémon is one indexed page, so a Pokémon is a single Search API query on @uri, cached on the
// server: the index only changes when the source rebuilds.
export async function getPokemon(slug: string): Promise<SearchApiResult | null> {
  "use cache";
  cacheLife("hours");
  if (isSampleOrg || !isValidSlug(slug)) return null;
  const { accessToken } = searchEngineConfiguration();
  const res = await fetch(searchApiUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      aq: `@uri=="${pokemonUri(slug)}"`,
      numberOfResults: 1,
      fieldsToInclude: [...fieldsToInclude, ...Object.values(matchupFields), ...Object.values(statFields)],
      searchHub,
    }),
  });
  if (!res.ok) throw new Error(`Coveo Search API ${res.status}`);
  const data = (await res.json()) as { results: SearchApiResult[] };
  return data.results[0] ?? null;
}

export function values(result: SearchApiResult, field: string): string[] {
  const raw = field ? result.raw[field] : undefined;
  if (Array.isArray(raw)) return raw.map(String);
  return raw == null ? [] : [String(raw)];
}
