import { formatClock } from "@/shared/lib/time";

type Props = {
  durationMs: number;
  size?: "display" | "widget";
};

export function ElapsedTime({ durationMs, size = "display" }: Props) {
  return (
    <time className={`elapsed elapsed-${size}`} dateTime={formatClock(durationMs)}>
      {formatClock(durationMs)}
    </time>
  );
}
