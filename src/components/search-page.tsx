"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  buildContext,
  buildFacet,
  buildGeneratedAnswer,
  buildPager,
  buildQuerySummary,
  buildResultList,
  buildSearchBox,
  buildSearchEngine,
  buildUrlManager,
} from "@coveo/headless";
import { fields, fieldsToInclude, isSampleOrg, searchEngineConfiguration } from "@/lib/coveo-config";
import { SearchBox } from "./search-box";
import { Facet } from "./facet";
import { ResultList } from "./result-list";
import { GeneratedAnswer } from "./generated-answer";
import { Pager, QuerySummary } from "./pager";

export function SearchPage() {
  const c = useMemo(() => {
    const engine = buildSearchEngine({ configuration: searchEngineConfiguration() });
    // Relevance testing: ?semantic=off sends context { semantic: "off" }, which the PokemonSearch pipeline uses to
    // skip the Semantic Encoder (keyword-only retrieval). Any other value, or none, keeps hybrid retrieval.
    const semanticParam = new URLSearchParams(window.location.search).get("semantic");
    if (semanticParam === "off") buildContext(engine).add("semantic", "off");
    return {
      engine,
      semanticParam,
      searchBox: buildSearchBox(engine, { options: { numberOfSuggestions: 6, highlightOptions: {} } }),
      types: buildFacet(engine, {
        options: { field: fields.types, numberOfValues: 18, sortCriteria: "occurrences" },
      }),
      generation: buildFacet(engine, {
        options: { field: fields.generation, numberOfValues: 9, sortCriteria: "alphanumeric" },
      }),
      results: buildResultList(engine, { options: { fieldsToInclude } }),
      answer: buildGeneratedAnswer(engine, {
        fieldsToIncludeInCitations: fieldsToInclude,
        initialState: { responseFormat: { contentFormat: ["text/markdown", "text/plain"] } },
      }),
      summary: buildQuerySummary(engine),
      pager: buildPager(engine),
    };
  }, []);

  const started = useRef(false);

  useEffect(() => {
    // Keep query and facet selections in the URL fragment so searches are shareable.
    const urlManager = buildUrlManager(c.engine, {
      initialState: { fragment: window.location.hash.slice(1) },
    });
    const unsubscribe = urlManager.subscribe(() => {
      const hash = `#${urlManager.state.fragment}`;
      if (window.location.hash !== hash) history.replaceState(null, "", hash);
    });
    const onHashChange = () => urlManager.synchronize(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHashChange);
    // StrictMode mounts effects twice in dev; a second first-search would abort the first one.
    if (!started.current) {
      started.current = true;
      c.engine.executeFirstSearch();
    }
    return () => {
      unsubscribe();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [c]);

  return (
    <div className="layout">
      {isSampleOrg && (
        <p className="notice">
          Running against Coveo&apos;s public sample org. Set <code>NEXT_PUBLIC_COVEO_ORG_ID</code> and{" "}
          <code>NEXT_PUBLIC_COVEO_API_KEY</code> to search the Pokémon index.
        </p>
      )}
      {c.semanticParam !== null && <RetrievalMode off={c.semanticParam === "off"} />}
      <SearchBox controller={c.searchBox} />
      <div className="columns">
        <aside className="facets">
          <Facet controller={c.types} title={isSampleOrg ? "Source" : "Type"} />
          <Facet controller={c.generation} title={isSampleOrg ? "File type" : "Generation"} />
        </aside>
        <main className="results">
          <GeneratedAnswer controller={c.answer} />
          <QuerySummary controller={c.summary} />
          <ResultList controller={c.results} engine={c.engine} />
          <Pager controller={c.pager} />
        </main>
      </div>
    </div>
  );
}

// Shown only when the URL has ?semantic=…, so regular visitors never see it. Switching reloads the page, because the
// context is set when the engine is built; the hash keeps the current query and facets.
function RetrievalMode({ off }: { off: boolean }) {
  const switchTo = (value: "on" | "off") => {
    // A full reload is intentional: the engine (and its context) is built once per page load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${window.location.pathname}?semantic=${value}${window.location.hash}`;
  };
  return (
    <p className={off ? "retrieval-mode off" : "retrieval-mode"}>
      Retrieval: <b>{off ? "keyword only (Semantic Encoder off)" : "hybrid (keywords + Semantic Encoder)"}</b>
      <button type="button" onClick={() => switchTo(off ? "on" : "off")}>
        Switch to {off ? "hybrid" : "keyword only"}
      </button>
    </p>
  );
}
