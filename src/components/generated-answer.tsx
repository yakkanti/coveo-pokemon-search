"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import type { GeneratedAnswer as GeneratedAnswerController, GeneratedAnswerCitation } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";
import { fields, plainText, pokemonSlug } from "@/lib/coveo-config";
import { tidyAnswer } from "@/lib/tidy-answer";

// The description shown for a cited Pokémon: the first paragraph of pokemon_summary, which citations carry
// because the controller requests fieldsToIncludeInCitations.
function description(citation: GeneratedAnswerCitation): string {
  const raw = citation.fields?.[fields.summary];
  const summary = Array.isArray(raw) ? raw.join("</p><p>") : typeof raw === "string" ? raw : "";
  return summary ? plainText(summary).split("\n\n")[0] : "";
}

function pokemonName(citation: GeneratedAnswerCitation): string {
  const raw = citation.fields?.[fields.name];
  return (Array.isArray(raw) ? raw[0] : raw)?.toString() || citation.title;
}

// Renders the RGA answer when the pipeline has an RGA model; renders nothing otherwise.
// The section shows the one-line answer, then each cited Pokémon with its description from the index.
// The answer is requested as Markdown. react-markdown builds React elements and ignores raw HTML,
// so model output can't inject markup into the page.
export function GeneratedAnswer({ controller }: { controller: GeneratedAnswerController }) {
  const state = useControllerState(controller);
  if (!state.isVisible || (!state.answer && !state.isLoading)) return null;

  // One entry per cited Pokémon (RGA can cite several chunks of the same page).
  const seen = new Set<string>();
  const cited = state.citations.filter((c) => {
    const key = pokemonSlug(c.clickUri ?? c.uri) ?? c.uri;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const pokemon = cited.filter((c) => pokemonSlug(c.clickUri ?? c.uri));
  const otherSources = cited.filter((c) => !pokemonSlug(c.clickUri ?? c.uri));

  return (
    // Fixed height (50% of the viewport): the header stays put, the answer and descriptions scroll below it.
    <section className="answer" aria-live="polite">
      <div className="answer-header">
        <h2>Generated answer</h2>
        {!state.isStreaming && state.answer && (
          <div className="feedback">
            <button type="button" disabled={state.liked} onClick={() => controller.like()}>
              Helpful
            </button>
            <button type="button" disabled={state.disliked} onClick={() => controller.dislike()}>
              Not helpful
            </button>
          </div>
        )}
      </div>
      <div className="answer-body" tabIndex={0} aria-label="Generated answer text">
        {state.isLoading && !state.answer ? (
          <p className="muted">Generating…</p>
        ) : state.answerContentFormat === "text/markdown" ? (
          <div className="answer-markdown">
            <Markdown>{tidyAnswer(state.answer ?? "")}</Markdown>
          </div>
        ) : (
          <p className="answer-text">{tidyAnswer(state.answer ?? "")}</p>
        )}

        {pokemon.length > 0 && (
          <ul className="answer-pokemon" aria-label="Pokémon in this answer">
            {pokemon.map((c) => (
              <li key={c.id}>
                {/* The name opens the app's detail page and counts as a citation click. */}
                <Link href={`/pokemon/${pokemonSlug(c.clickUri ?? c.uri)}`} onClick={() => controller.logCitationClick(c.id)}>
                  {pokemonName(c)}
                </Link>
                {description(c) && <p>{description(c)}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {otherSources.length > 0 && (
        <ol className="citations" aria-label="Other sources">
          {otherSources.map((c) => (
            <li key={c.id}>
              <a href={c.clickUri ?? c.uri} target="_blank" rel="noreferrer" onClick={() => controller.logCitationClick(c.id)}>
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
