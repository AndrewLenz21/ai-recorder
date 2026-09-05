import { useMeetingDetection } from "../hooks/useMeetingDetection";

type Props = {
  compact?: boolean;
};

export function MeetingHint({ compact = false }: Props) {
  const snapshot = useMeetingDetection();
  const teams = snapshot?.runningApps.find((app) => app.id === "microsoft-teams");

  if (!teams) {
    return null;
  }

  const text = teams.focused
    ? "Microsoft Teams is in the foreground"
    : "Microsoft Teams is running";

  return <p className={`meeting-hint ${compact ? "is-compact" : ""}`}>{text}</p>;
}
