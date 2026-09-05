import { Button } from "@/shared/components/Button";

import { usePermissions } from "../hooks/usePermissions";

export function PermissionsBanner() {
  const { status, request } = usePermissions();

  if (!status || status.screenRecording === "granted" || status.screenRecording === "unknown") {
    return null;
  }

  return (
    <aside className="permission-banner">
      <div>
        <strong>Screen capture needs permission</strong>
        <p>macOS will ask once. Grant Screen Recording so screenshots can be saved with the timeline.</p>
      </div>
      <Button size="sm" onClick={() => void request("screen")}>
        Enable
      </Button>
    </aside>
  );
}
