import { useCallback, useSyncExternalStore } from "react";

import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  startThemeTransition,
  type Theme,
} from "./theme";

let currentTheme: Theme = "light";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function hydrateTheme() {
  currentTheme = readStoredTheme();
  applyTheme(currentTheme);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setTheme = useCallback((next: Theme) => {
    if (next === currentTheme) {
      return;
    }
    startThemeTransition();
    currentTheme = next;
    applyTheme(next);
    persistTheme(next);
    emit();
  }, []);

  return { theme, setTheme };
}
