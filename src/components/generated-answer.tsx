"use client";

import type { GeneratedAnswer as GeneratedAnswerController } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";

// Renders the RGA answer when the pipeline has an RGA model; renders nothing otherwise.
export function GeneratedAnswer({ controller }: { controller: GeneratedAnswerController }) {
  const state = useControllerState(controller);
  if (!state.isVisible || (!state.answer && !state.isLoading)) return null;

  return (
    <section className="answer" aria-live="polite">
      <h2>Generated answer</h2>
      {state.isLoading && !state.answer ? (
        <p className="muted">Generating…</p>
      ) : (
        <p className="answer-text">{state.answer}</p>
      )}
      {state.citations.length > 0 && (
        <ol className="citations">
          {state.citations.map((c) => (
            <li key={c.id}>
              <a
                href={c.clickUri ?? c.uri}
                target="_blank"
                rel="noreferrer"
                onClick={() => controller.logCitationClick(c.id)}
              >
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      )}
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
    </section>
  );
}
