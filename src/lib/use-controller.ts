"use client";

import { useEffect, useState } from "react";

interface Controller<S> {
  state: S;
  subscribe(listener: () => void): () => void;
}

// Headless `state` is a getter that returns a new object on every read, so it can't back
// useSyncExternalStore directly. Copy it into React state on each controller notification instead.
export function useControllerState<S>(controller: Controller<S>): S {
  const [state, setState] = useState(controller.state);
  useEffect(() => controller.subscribe(() => setState(controller.state)), [controller]);
  return state;
}
