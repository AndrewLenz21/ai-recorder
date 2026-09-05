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
      className="section-action group inline-flex h-9 w-max min-w-9 max-w-9 shrink-0 items-center justify-end overflow-hidden whitespace-nowrap rounded-full border border-transparent bg-transparent px-2.5 text-foreground transition-[max-width,background-color,border-color] duration-200 ease-app hover:max-w-[148px] hover:border-border hover:bg-surface focus-visible:max-w-[148px] focus-visible:border-border focus-visible:bg-surface [&>svg]:shrink-0"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      <span className="section-action-label mr-1.5 translate-x-1.5 text-[13px] font-semibold opacity-0 transition-[opacity,transform] duration-200 ease-app group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
        {label}
      </span>
      {icon}
    </button>
  );
}
