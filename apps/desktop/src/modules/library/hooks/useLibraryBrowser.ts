import { useEffect, useState } from "react";

export type LibraryViewMode = "list" | "grid";

type BrowserState = {
  mode: LibraryViewMode;
  showFolders: boolean;
  showRecordings: boolean;
};

const KEY = "ai-recorder.library-browser";

const DEFAULT_STATE: BrowserState = {
  mode: "list",
  showFolders: true,
  showRecordings: true,
};

function readState(): BrowserState {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(stored) as Partial<BrowserState>;
    const mode = parsed.mode === "grid" ? "grid" : "list";
    const showFolders = parsed.showFolders !== false;
    const showRecordings = parsed.showRecordings !== false;
    if (!showFolders && !showRecordings) {
      return { mode, showFolders: true, showRecordings: true };
    }
    return { mode, showFolders, showRecordings };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useLibraryBrowser() {
  const [state, setState] = useState<BrowserState>(readState);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Ignore private-mode storage errors.
    }
  }, [state]);

  const setMode = (mode: LibraryViewMode) => {
    setState((current) => ({ ...current, mode }));
  };

  const setTypes = (showFolders: boolean, showRecordings: boolean) => {
    if (!showFolders && !showRecordings) {
      return;
    }
    setState((current) => ({ ...current, showFolders, showRecordings }));
  };

  return {
    ...state,
    setMode,
    setTypes,
  };
}
