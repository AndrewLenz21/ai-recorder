import { GridViewIcon, ListViewIcon } from "@/shared/components/icons";

import type { LibraryViewMode } from "../hooks/useLibraryBrowser";

type Props = {
  value: LibraryViewMode;
  onChange: (value: LibraryViewMode) => void;
};

export function ViewModeToggle({ value, onChange }: Props) {
  const next = value === "list" ? "grid" : "list";

  return (
    <button
      type="button"
      className="view-mode-toggle"
      aria-label={next === "grid" ? "Switch to grid view" : "Switch to list view"}
      title={next === "grid" ? "Grid view" : "List view"}
      onClick={() => onChange(next)}
    >
      <span className={value === "list" ? "is-active" : ""}>
        <ListViewIcon size={15} />
      </span>
      <span className={value === "grid" ? "is-active" : ""}>
        <GridViewIcon size={15} />
      </span>
    </button>
  );
}
