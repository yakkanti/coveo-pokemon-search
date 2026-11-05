"use client";

import type { Facet as FacetController } from "@coveo/headless";
import { useControllerState } from "@/lib/use-controller";

export function Facet({ controller, title }: { controller: FacetController; title: string }) {
  const state = useControllerState(controller);
  if (state.values.length === 0) return null;

  return (
    <fieldset className="facet">
      <legend>{title}</legend>
      {state.values.map((v) => (
        <label key={v.value}>
          <input
            type="checkbox"
            checked={controller.isValueSelected(v)}
            onChange={() => controller.toggleSelect(v)}
          />
          <span>{v.value}</span>
          <span className="count">{v.numberOfResults}</span>
        </label>
      ))}
      {state.hasActiveValues && (
        <button type="button" className="link" onClick={() => controller.deselectAll()}>
          Clear
        </button>
      )}
    </fieldset>
  );
}
