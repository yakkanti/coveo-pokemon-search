"use client";

import { useRef, useState } from "react";
import Markdown from "react-markdown";
import type { AskEvent } from "@/app/api/ask/route";

type Status = "idle" | "asking" | "done" | "error";

// "Ask about this Pokémon": streams a grounded answer from /api/ask (Coveo Passage Retrieval + Claude).
export function AskPokemon({ slug, name }: { slug: string; name: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{ title: string; quote: string }[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const suggestions = [`What is ${name} weak against?`, `What does ${name} evolve into?`, `What are ${name}'s best stats?`];

  async function ask(q: string) {
    const text = q.trim();
    if (!text) {
      setError("Type a question first.");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setQuestion(text);
    setAnswer("");
    setSources([]);
    setError("");
    setStatus("asking");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, question: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      // The route streams newline-delimited JSON events.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AskEvent;
          if (event.type === "text") setAnswer((a) => a + event.text);
          else if (event.type === "sources") setSources(event.sources);
          else if (event.type === "error") throw new Error(event.message);
        }
      }
      setStatus("done");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <section className="ask" aria-labelledby="ask-title">
      <h2 id="ask-title">Ask about {name}</h2>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          type="text"
          value={question}
          maxLength={300}
          placeholder={`e.g. ${suggestions[0]}`}
          aria-label={`Ask a question about ${name}`}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (error) setError("");
          }}
        />
        <button type="submit" disabled={status === "asking"}>
          {status === "asking" ? "Asking…" : "Ask"}
        </button>
      </form>
      {error && <p className="ask-error" role="alert">{error}</p>}
      <div className="ask-suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={status === "asking"} onClick={() => void ask(s)}>
            {s}
          </button>
        ))}
      </div>

      {(answer || status === "asking") && (
        <div className="ask-answer" aria-live="polite">
          {answer ? <Markdown>{answer}</Markdown> : <p className="muted">Looking through {name}&apos;s Pokédex…</p>}
          {sources.length > 0 && (
            <ol className="ask-sources" aria-label="Sources">
              {sources.map((s) => (
                <li key={s.title}>
                  <span className="ask-source-title">{s.title}</span>
                  {s.quote && <q>{s.quote.length > 140 ? `${s.quote.slice(0, 140)}…` : s.quote}</q>}
                </li>
              ))}
            </ol>
          )}
          {status === "done" && (
            <p className="ask-footnote">Answered by Claude from passages retrieved by Coveo.</p>
          )}
        </div>
      )}
    </section>
  );
}
