"use client";

import dynamic from "next/dynamic";

// The Headless engine is browser-only (it reads the clock, storage and the URL), so skip server rendering.
export const SearchPageClient = dynamic(() => import("./search-page").then((m) => m.SearchPage), {
  ssr: false,
  loading: () => <p className="layout muted">Loading search…</p>,
});
