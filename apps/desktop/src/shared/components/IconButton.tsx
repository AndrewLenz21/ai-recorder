import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({ label, className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`icon-btn inline-flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-foreground transition-[background-color,transform] duration-[var(--duration)] ease-app hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-foreground ${className}`.trim()}
      {...props}
    />
  );
}
