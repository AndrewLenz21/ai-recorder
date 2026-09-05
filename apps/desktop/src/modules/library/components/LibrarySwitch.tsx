import { useLibrary } from "../hooks/useLibrary";
import type { LibrarySection } from "../types";

const SECTIONS: { id: LibrarySection; label: string }[] = [
  { id: "root", label: "Dashboard" },
  { id: "all", label: "Recordings" },
  { id: "storage", label: "Storage" },
];

export function LibrarySwitch() {
  const { route, setRoute } = useLibrary();
  const active: LibrarySection = route.name === "all" || route.name === "storage" ? route.name : "root";

  return (
    <nav className="library-switch" aria-label="Library">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className={section.id === active ? "is-active" : ""}
          aria-current={section.id === active ? "page" : undefined}
          onClick={() => setRoute({ name: section.id })}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
