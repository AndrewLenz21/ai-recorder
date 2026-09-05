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
    return <div className="capture-veil" aria-hidden="true" />;
  }

  return (
    <>
      <div className="capture-veil is-on" aria-hidden="true" />
      <div className="capture-thumb">
        <img src={convertFileSrc(lastCapture.imagePath)} alt="" />
      </div>
    </>
  );
}
