import { Button } from "@/shared/components/Button";

import { usePermissions } from "../hooks/usePermissions";

export function PermissionsBanner() {
  const { status, request } = usePermissions();

  if (!status || status.screenRecording === "granted" || status.screenRecording === "unknown") {
    return null;
  }

  return (
    <aside className="mb-6 flex items-center justify-between gap-4 rounded-app border border-border bg-surface px-4 py-3.5 backdrop-blur-[18px] max-[640px]:flex-col max-[640px]:items-start">
      <div>
        <strong>Screen capture needs permission</strong>
        <p className="text-[13px] leading-[1.45] text-muted-foreground">
          macOS will ask once. Grant Screen Recording so screenshots can be saved with the timeline.
        </p>
      </div>
      <Button size="sm" onClick={() => void request("screen")}>
        Enable
      </Button>
    </aside>
  );
}
