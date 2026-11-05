import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import {
  fields,
  fieldsToInclude,
  isSampleOrg,
  plainText,
  searchApiUrl,
  searchEngineConfiguration,
  searchHub,
} from "@/lib/coveo-config";

interface SearchApiResult {
  title: string;
  clickUri: string;
  excerpt: string;
  raw: Record<string, unknown>;
}

// One Pokémon is one indexed page, so the detail page is a single Search API query on @uri,
// rendered on the server and cached: the index only changes when the source rebuilds.
async function getPokemon(slug: string): Promise<SearchApiResult | null> {
  "use cache";
  cacheLife("hours");
  if (isSampleOrg || !/^[a-z0-9-]+$/.test(slug)) return null;
  const { accessToken } = searchEngineConfiguration();
  const res = await fetch(searchApiUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      aq: `@uri=="https://pokemondb.net/pokedex/${slug}"`,
      numberOfResults: 1,
      fieldsToInclude,
      searchHub,
    }),
  });
  if (!res.ok) throw new Error(`Coveo Search API ${res.status}`);
  const data = (await res.json()) as { results: SearchApiResult[] };
  return data.results[0] ?? null;
}

function values(result: SearchApiResult, field: string): string[] {
  const raw = field ? result.raw[field] : undefined;
  if (Array.isArray(raw)) return raw.map(String);
  return raw == null ? [] : [String(raw)];
}

export async function generateMetadata(props: PageProps<"/pokemon/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const pokemon = await getPokemon(slug);
  const name = pokemon && (values(pokemon, fields.name)[0] ?? pokemon.title);
  return { title: name ? `${name} · Tall Grass` : "Pokémon not found" };
}

// The banner and back link are part of the static shell; the Pokémon itself streams in once params resolve.
export default function PokemonPage(props: PageProps<"/pokemon/[slug]">) {
  return (
    <>
      <Banner home={false} />
      <div className="detail">
        <Link href="/" className="back">← Back to search</Link>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <PokemonDetail params={props.params} />
        </Suspense>
      </div>
    </>
  );
}

async function PokemonDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isSampleOrg) {
    return <p className="notice">Detail pages need the Pokémon index. Configure the Coveo org env vars first.</p>;
  }
  const pokemon = await getPokemon(slug);
  if (!pokemon) notFound();

  const name = values(pokemon, fields.name)[0] ?? pokemon.title;
  const image = values(pokemon, fields.image)[0];
  const summary = values(pokemon, fields.summary).join("</p><p>");
  const rows: [string, string][] = [
    ["National №", values(pokemon, fields.number)[0] ?? "—"],
    ["Type", values(pokemon, fields.types).join(" / ") || "—"],
    ["Species", values(pokemon, fields.species)[0] ?? "—"],
    ["Introduced", values(pokemon, fields.generation)[0] ?? "—"],
  ];

  return (
    <>
      <div className="detail-hero">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} width={240} height={240} />
        )}
        <div>
          <h1>{name}</h1>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="summary-text">{summary ? plainText(summary) : pokemon.excerpt}</p>
      <p className="source">
        Source: <a href={pokemon.clickUri} target="_blank" rel="noreferrer">{pokemon.clickUri}</a>
      </p>
    </>
  );
}
