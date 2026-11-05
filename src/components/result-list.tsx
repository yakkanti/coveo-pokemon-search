"use client";

import Link from "next/link";
import {
  buildInteractiveResult,
  type Result,
  type ResultList as ResultListController,
  type SearchEngine,
} from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";
import { fields, plainText, pokemonSlug } from "@/lib/coveo-config";

function fieldList(result: Result, field: string): string[] {
  const raw = field ? result.raw[field] : undefined;
  if (Array.isArray(raw)) return raw.map(String);
  return raw == null ? [] : [String(raw)];
}

function ResultCard({ result, engine }: { result: Result; engine: SearchEngine }) {
  // Sends the click event Coveo ML (ART, QS) learns from.
  const interactive = buildInteractiveResult(engine, { options: { result } });
  const slug = pokemonSlug(result.clickUri);
  const image = fieldList(result, fields.image)[0];
  const types = fieldList(result, fields.types);
  const generation = fieldList(result, fields.generation)[0];
  const number = fieldList(result, fields.number)[0];
  // Page titles are "Gastly Pokédex: stats, moves…", so prefer the scraped name.
  const name = fieldList(result, fields.name)[0] ?? result.title;
  // The scraped intro reads better than the excerpt, which often lands in the stats tables.
  const summary = fieldList(result, fields.summary).join("</p><p>");

  const body = (
    <>
      {image ? (
        // Images come from img.pokemondb.net; a plain img avoids configuring remote patterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={96} height={96} loading="lazy" />
      ) : (
        <div className="img-placeholder" aria-hidden />
      )}
      <div>
        <h3>
          {number && <span className="dex">#{number.padStart(4, "0")}</span>} {name}
        </h3>
        <p className="tags">
          {types.map((t) => (
            <span key={t} className={`type type-${t.toLowerCase()}`}>
              {t}
            </span>
          ))}
          {generation && <span className="gen">{generation}</span>}
        </p>
        <p className="excerpt">{summary ? plainText(summary).split("\n\n")[0] : result.excerpt}</p>
      </div>
    </>
  );

  return (
    <li className="result">
      {slug ? (
        <Link href={`/pokemon/${slug}`} onClick={() => interactive.select()}>
          {body}
        </Link>
      ) : (
        <a href={result.clickUri} onClick={() => interactive.select()} target="_blank" rel="noreferrer">
          {body}
        </a>
      )}
    </li>
  );
}

export function ResultList({ controller, engine }: { controller: ResultListController; engine: SearchEngine }) {
  const state = useControllerState(controller);
  if (!state.firstSearchExecuted) return <p className="muted">Loading…</p>;
  if (!state.hasResults) return <p className="muted">No Pokémon match that search.</p>;

  return (
    <ul className="result-list">
      {state.results.map((r) => (
        <ResultCard key={r.uniqueId} result={r} engine={engine} />
      ))}
    </ul>
  );
}
