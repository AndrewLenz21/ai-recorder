import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
};

export function SectionAction({ label, icon, onClick, ariaLabel }: Props) {
  return (
    <button
      type="button"
      className="section-action"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      <span className="section-action-label">{label}</span>
      {icon}
    </button>
  );
}
