import { useRef } from "react";

import { useAudioPlayer } from "../hooks/useAudioPlayer";

function ratioFromEvent(element: HTMLElement, clientX: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function SeekBar() {
  const { currentTime, duration, seek } = useAudioPlayer();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const progress = duration > 0 ? currentTime / duration : 0;

  const seekFromEvent = (clientX: number) => {
    if (!trackRef.current || duration <= 0) {
      return;
    }
    seek(ratioFromEvent(trackRef.current, clientX) * duration);
  };

  return (
    <div
      ref={trackRef}
      className="seek-bar"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromEvent(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) {
          seekFromEvent(event.clientX);
        }
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          seek(currentTime + 5);
        }
        if (event.key === "ArrowLeft") {
          seek(currentTime - 5);
        }
      }}
    >
      <span className="seek-track" />
      <span className="seek-fill" style={{ width: `${progress * 100}%` }} />
      <span className="seek-thumb" style={{ left: `${progress * 100}%` }} />
    </div>
  );
}
