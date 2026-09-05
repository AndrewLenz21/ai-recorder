import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { useScreenCaptureStore } from "../stores/screen-capture.store";

export function CaptureFlash() {
  const lastCapture = useScreenCaptureStore((state) => state.lastCapture);
  const flashUntil = useScreenCaptureStore((state) => state.flashUntil);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (flashUntil <= Date.now() || !lastCapture) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), flashUntil - Date.now());
    return () => window.clearTimeout(timeout);
  }, [flashUntil, lastCapture]);

  if (!visible || !lastCapture) {
    return <div className="pointer-events-none fixed inset-0 bg-white opacity-0" aria-hidden="true" />;
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-white opacity-[0.18]" aria-hidden="true" />
      <div className="fixed right-7 bottom-7 w-[132px] overflow-hidden rounded-xl shadow-app motion-safe:animate-[thumb-in_220ms_var(--ease)]">
        <img className="h-[84px] w-[132px] object-cover" src={convertFileSrc(lastCapture.imagePath)} alt="" />
      </div>
    </>
  );
}
