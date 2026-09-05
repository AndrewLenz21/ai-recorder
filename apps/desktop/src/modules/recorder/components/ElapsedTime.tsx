import { formatClock } from "@/shared/lib/time";

type Props = {
  durationMs: number;
  size?: "display" | "widget";
};

export function ElapsedTime({ durationMs, size = "display" }: Props) {
  return (
    <time
      className={
        size === "display"
          ? "text-[clamp(48px,10vw,80px)] leading-none font-[590] tracking-[-0.05em] tabular-nums"
          : "text-[15px] font-semibold tracking-[-0.03em] tabular-nums"
      }
      dateTime={formatClock(durationMs)}
    >
      {formatClock(durationMs)}
    </time>
  );
}
