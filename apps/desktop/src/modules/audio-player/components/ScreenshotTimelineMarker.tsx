import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CaptureIcon } from "@/shared/components/icons";
import { usePresence } from "@/shared/hooks/usePresence";
import { formatTimestamp } from "@/shared/lib/time";

import type { ScreenshotCue } from "../types";

type Props = {
  cue: ScreenshotCue;
  duration: number;
  selected: boolean;
  active: boolean;
  onSelect: (id: string, seconds: number) => void;
};

export function ScreenshotTimelineMarker({ cue, duration, selected, active, onSelect }: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const { present, entered } = usePresence(open, 160);
  const stamp = formatTimestamp(cue.timestampMs);
  const left = duration > 0 ? Math.min(100, Math.max(0, (cue.timestampMs / 1000 / duration) * 100)) : 0;

  useEffect(() => {
    if (!hovered) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 180);
    return () => window.clearTimeout(timer);
  }, [hovered]);

  useEffect(() => {
    if (!open || !rootRef.current) {
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const leftPos = Math.min(window.innerWidth - 132, Math.max(132, rect.left + rect.width / 2));
    const top = Math.max(12, rect.top);
    setCoords({ top, left: leftPos });
  }, [open]);

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className={`waveform-marker ${selected ? "is-selected" : ""} ${active ? "is-active" : ""} ${left > 86 ? "is-end" : ""}`}
        style={{ left: `${left}%` }}
        aria-label={`Screenshot captured at ${stamp}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(cue.id, cue.timestampMs / 1000);
        }}
      >
        <span className="waveform-marker-chip">
          <span className="waveform-marker-icon">
            <CaptureIcon size={12} />
          </span>
          <span className="waveform-marker-time">{stamp}</span>
        </span>
        <span className="waveform-marker-stem" />
      </button>
      {present
        ? createPortal(
            <div
              className={`waveform-preview ${entered ? "is-open" : ""}`}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              <img src={cue.imageSrc} alt="" />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
