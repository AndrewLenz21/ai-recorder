import { PermissionsBanner } from "@/modules/permissions";
import {
  RecorderHome,
  RecorderSession,
  RecordingSummary,
  useRecorderView,
} from "@/modules/recorder";

import { MainLayout } from "./layouts/MainLayout";
import { NativeBridge } from "./providers/NativeBridge";

export function App() {
  return (
    <NativeBridge>
      <MainLayout>
        <PermissionsBanner />
        <MainView />
      </MainLayout>
    </NativeBridge>
  );
}

function MainView() {
  const view = useRecorderView();

  if (view === "session") {
    return <RecorderSession />;
  }
  if (view === "summary") {
    return <RecordingSummary />;
  }
  return <RecorderHome />;
}
