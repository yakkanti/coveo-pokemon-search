"use client";

import type { Pager as PagerController, QuerySummary as QuerySummaryController } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";

export function QuerySummary({ controller }: { controller: QuerySummaryController }) {
  const s = useControllerState(controller);
  if (!s.hasResults) return null;
  return (
    <p className="muted summary">
      Results {s.firstResult}–{s.lastResult} of {s.total}
      {s.hasQuery && <> for “{s.query}”</>} ({s.durationInSeconds}s)
    </p>
  );
}

export function Pager({ controller }: { controller: PagerController }) {
  const s = useControllerState(controller);
  if (s.maxPage <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" disabled={!s.hasPreviousPage} onClick={() => controller.previousPage()}>
        Previous
      </button>
      {s.currentPages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={controller.isCurrentPage(p) ? "page" : undefined}
          onClick={() => controller.selectPage(p)}
        >
          {p}
        </button>
      ))}
      <button type="button" disabled={!s.hasNextPage} onClick={() => controller.nextPage()}>
        Next
      </button>
    </nav>
  );
}
