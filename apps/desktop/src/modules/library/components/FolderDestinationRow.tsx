import type { ReactNode } from "react";

import { CheckIcon } from "@/shared/components/icons";

type Props = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function FolderDestinationRow({ title, subtitle, selected = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      className={`destination-row ${selected ? "is-selected" : ""}`}
      onClick={onClick}
    >
      <span className="destination-row-icon">{children}</span>
      <span className="destination-row-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
      {selected ? <CheckIcon size={16} /> : null}
    </button>
  );
}
