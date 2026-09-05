import { useEffect, useRef } from "react";

import { LibraryApp, RecordingDetail } from "@/modules/library";
import { useLibraryStore } from "@/modules/library/stores/library.store";
import { PermissionsBanner } from "@/modules/permissions";
import { RecorderSession, useRecorderView } from "@/modules/recorder";
import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";
import { showToast } from "@/shared/stores/toast.store";
import type { RecordingStatus } from "@/tauri/types";

import { MainLayout } from "./layouts/MainLayout";
import { NativeBridge } from "./providers/NativeBridge";

export function App() {
  const view = useRecorderView();

  return (
    <NativeBridge>
      <SaveNotice />
      <MainLayout wide={view === "summary"}>
        {view === "summary" ? null : <PermissionsBanner />}
        <MainView view={view} />
      </MainLayout>
    </NativeBridge>
  );
}

function SaveNotice() {
  const status = useRecorderStore((state) => state.status);
  const previous = useRef<RecordingStatus>(status);

  useEffect(() => {
    if (
      (previous.current === "stopping" || previous.current === "recording" || previous.current === "paused") &&
      status === "completed"
    ) {
      const session = useRecorderStore.getState().session;
      const library = useLibraryStore.getState();
      const folder = library.folders.find((item) => item.id === session?.folderId);
      showToast("success", "Recording saved", folder ? folder.name : "All Recordings");
      library.setDestinationFolderId(library.defaultFolderId);
    }
    previous.current = status;
  }, [status]);

  return null;
}

function MainView({ view }: { view: ReturnType<typeof useRecorderView> }) {
  if (view === "session") {
    return <RecorderSession />;
  }
  if (view === "summary") {
    return <RecordingDetail />;
  }
  return <LibraryApp />;
}
