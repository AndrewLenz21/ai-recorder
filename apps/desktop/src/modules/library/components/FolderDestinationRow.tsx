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
      className={`group flex min-h-14 w-full items-center gap-3 rounded-xl border-0 px-2.5 py-2 text-left text-foreground transition-colors duration-160 ease-app hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground ${selected ? "bg-border" : "bg-transparent"}`}
      onClick={onClick}
    >
      <span className="shrink-0 transition-transform duration-160 ease-app group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px]">
        {children}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px transition-transform duration-160 ease-app group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px]">
        <strong className="text-sm font-semibold">{title}</strong>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
      {selected ? (
        <span className="shrink-0 text-muted-foreground">
          <CheckIcon size={16} />
        </span>
      ) : null}
    </button>
  );
}
