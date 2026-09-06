import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "record" | "stop";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
};

const base =
  "btn inline-flex items-center justify-center gap-2 rounded-full border border-transparent transition-[transform,background-color,opacity] duration-[var(--duration)] ease-app hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "btn-primary bg-control text-control-foreground",
  secondary: "btn-secondary border-border bg-surface text-foreground backdrop-blur-[20px]",
  ghost: "btn-ghost bg-transparent text-foreground",
  record: "btn-record bg-record text-control-foreground",
  stop: "btn-stop bg-foreground text-background",
};

const sizes = {
  sm: "btn-sm min-h-8 px-3 text-[13px]",
  md: "btn-md min-h-10 px-4 text-sm",
  lg: "btn-lg min-h-12 px-[22px] text-base",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  busy = false,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${busy ? "is-busy" : ""} ${className}`.trim()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
