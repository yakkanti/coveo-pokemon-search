"use client";

import { useState } from "react";
import type { SearchBox as SearchBoxController } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";

export function SearchBox({ controller }: { controller: SearchBoxController }) {
  const state = useControllerState(controller);
  const [open, setOpen] = useState(false);

  return (
    <form
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        controller.submit();
        setOpen(false);
      }}
    >
      <input
        type="search"
        aria-label="Search Pokémon"
        placeholder="Search Pokémon, e.g. fire starter, eevee evolutions…"
        value={state.value}
        onChange={(e) => {
          controller.updateText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          controller.showSuggestions();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <button type="submit">Search</button>
      {open && state.suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {state.suggestions.map((s) => (
            <li key={s.rawValue}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  controller.selectSuggestion(s.rawValue);
                  setOpen(false);
                }}
                // Highlighted suggestion markup comes from the Coveo Query Suggest API.
                dangerouslySetInnerHTML={{ __html: s.highlightedValue }}
              />
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
