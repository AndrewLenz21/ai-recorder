import { useMeetingDetection } from "../hooks/useMeetingDetection";

export function MeetingHint() {
  const snapshot = useMeetingDetection();
  const teams = snapshot?.runningApps.find((app) => app.id === "microsoft-teams");

  if (!teams) {
    return null;
  }

  const text = teams.focused
    ? "Microsoft Teams is in the foreground"
    : "Microsoft Teams is running";

  return <p className="text-[13px] text-muted-foreground">{text}</p>;
}
