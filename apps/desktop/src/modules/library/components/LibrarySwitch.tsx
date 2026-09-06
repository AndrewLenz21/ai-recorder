import { useLibrary } from "../hooks/useLibrary";
import type { LibrarySection } from "../types";

const SECTIONS: { id: LibrarySection; label: string }[] = [
  { id: "root", label: "Dashboard" },
  { id: "all", label: "Recordings" },
  { id: "storage", label: "Storage" },
];

export function LibrarySwitch() {
  const { route, setRoute } = useLibrary();
  const active: LibrarySection =
    route.name === "all" || route.name === "folder" ? "all" : route.name === "storage" ? route.name : "root";

  return (
    <nav className="flex self-center gap-0.5 rounded-xl bg-border p-[3px]" aria-label="Library">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`min-h-[30px] rounded-[9px] border-0 px-3 text-[13px] font-semibold transition-[background-color,color] duration-160 ease-app max-[640px]:px-2.5 max-[640px]:text-xs ${
            section.id === active
              ? "bg-surface text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)]"
              : "bg-transparent text-muted-foreground"
          }`}
          aria-current={section.id === active ? "page" : undefined}
          onClick={() => setRoute({ name: section.id })}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
