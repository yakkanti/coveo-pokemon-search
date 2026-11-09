import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { AskPokemon } from "@/components/ask-pokemon";
import { fields, isSampleOrg, plainText } from "@/lib/coveo-config";
import { getPokemon, values } from "@/lib/pokemon";

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
      <AskPokemon slug={slug} name={name} />
    </>
  );
}
