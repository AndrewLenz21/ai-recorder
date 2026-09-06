export const THEME_STORAGE_KEY = "ai-recorder.theme";

export const THEMES = [
  { id: "light", label: "Light", scheme: "light", swatch: "oklch(0.205 0 0)" },
  { id: "dark", label: "Dark", scheme: "dark", swatch: "oklch(0.922 0 0)" },
  { id: "atom", label: "Atom", scheme: "dark", swatch: "oklch(0.73 0.17 245)" },
  { id: "sky", label: "Sky", scheme: "light", swatch: "oklch(0.58 0.12 240)" },
  { id: "ocean", label: "Ocean", scheme: "light", swatch: "oklch(0.4 0.18 195)" },
  { id: "pink", label: "Pink", scheme: "light", swatch: "oklch(0.69 0.11 352)" },
  { id: "pressroom", label: "Pressroom", scheme: "light", swatch: "oklch(0.42 0.055 240)" },
] as const;

export type Theme = (typeof THEMES)[number]["id"];

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));

export function isTheme(value: string | null): value is Theme {
  return Boolean(value && THEME_IDS.has(value));
}

export function themeMeta(theme: Theme) {
  return THEMES.find((item) => item.id === theme) ?? THEMES[0];
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
  } catch {
    // Ignore private-mode storage errors.
  }
  return systemTheme();
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const item of THEMES) {
    root.classList.toggle(item.id, item.id === theme);
  }
  root.style.colorScheme = themeMeta(theme).scheme;
}

export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore private-mode storage errors.
  }
}

export function startThemeTransition() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  window.setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, 320);
}
