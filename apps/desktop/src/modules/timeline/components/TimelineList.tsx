import { formatTimestamp } from "@/shared/lib/time";

import { useTimeline } from "../hooks/useTimeline";

type Props = {
  compact?: boolean;
};

function labelFor(type: string): string {
  switch (type) {
    case "recordingStarted":
      return "Started";
    case "recordingPaused":
      return "Paused";
    case "recordingResumed":
      return "Resumed";
    case "recordingStopped":
      return "Stopped";
    case "screenCapture":
      return "Screenshot";
    default:
      return type;
  }
}

export function TimelineList({ compact = false }: Props) {
  const events = useTimeline();
  const visible = compact
    ? events.filter((event) => event.type === "screenCapture").slice(-3)
    : events;

  if (visible.length === 0) {
    return null;
  }

  return (
    <ol className="w-[min(320px,100%)] text-[13px] text-muted-foreground">
      {visible.map((event) => (
        <li className="flex justify-between gap-4 py-1.5 tabular-nums" key={event.id}>
          <span>{formatTimestamp(event.timestampMs)}</span>
          <span>
            {event.type === "screenCapture" ? event.fileName : labelFor(event.type)}
          </span>
        </li>
      ))}
    </ol>
  );
}
