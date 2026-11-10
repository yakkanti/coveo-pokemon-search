"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import type { GeneratedAnswer as GeneratedAnswerController, GeneratedAnswerCitation } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";
import { fields, plainText, pokemonSlug } from "@/lib/coveo-config";
import { tidyAnswer } from "@/lib/tidy-answer";
import { bestCitedSnippet } from "@/lib/cited-snippet";

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

  // One entry per cited Pokémon. RGA can cite several chunks of the same page, so keep all of each page's chunks
  // to find the cited portion in.
  const groups = new Map<string, { first: GeneratedAnswerCitation; chunks: string[] }>();
  for (const c of state.citations) {
    const key = pokemonSlug(c.clickUri ?? c.uri) ?? c.uri;
    const group = groups.get(key) ?? { first: c, chunks: [] };
    if (c.text) group.chunks.push(c.text);
    groups.set(key, group);
  }
  const cited = [...groups.values()];
  const pokemon = cited.filter((g) => pokemonSlug(g.first.clickUri ?? g.first.uri));
  const otherSources = cited.filter((g) => !pokemonSlug(g.first.clickUri ?? g.first.uri)).map((g) => g.first);
  // Only quote once the answer has finished streaming, so the quote doesn't flicker while text arrives.
  const answerText = state.isStreaming ? "" : tidyAnswer(state.answer ?? "");

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
            {pokemon.map(({ first: c, chunks }) => {
              const desc = description(c);
              const snippet = answerText ? bestCitedSnippet(chunks, answerText) : "";
              // Skip a quote that only repeats the description shown right above it.
              const same = (t: string) => t.replace(/[…"“”.]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
              const quote = snippet && !same(desc).includes(same(snippet)) ? snippet : "";
              return (
                <li key={c.id}>
                  {/* The name opens the app's detail page and counts as a citation click. */}
                  <Link href={`/pokemon/${pokemonSlug(c.clickUri ?? c.uri)}`} onClick={() => controller.logCitationClick(c.id)}>
                    {pokemonName(c)}
                  </Link>
                  {desc && <p>{desc}</p>}
                  {quote && (
                    <blockquote className="cited">
                      <span className="cited-label">Cited</span> “{quote}”
                    </blockquote>
                  )}
                  {chunks.length > 0 && (
                    <details className="cited-passage">
                      <summary>Show the passage RGA used{chunks.length > 1 ? `s (${chunks.length})` : ""}</summary>
                      {chunks.map((chunk, i) => (
                        <p key={i}>{chunk}</p>
                      ))}
                    </details>
                  )}
                </li>
              );
            })}
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
