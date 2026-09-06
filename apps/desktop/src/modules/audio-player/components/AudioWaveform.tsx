import { useEffect, useMemo, useRef, useState } from "react";

import { formatTimestamp } from "@/shared/lib/time";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useWaveformPeaks } from "../hooks/useWaveformPeaks";
import type { ScreenshotCue } from "../types";
import { downsamplePeaks } from "../waveform";
import { ScreenshotTimelineMarker } from "./ScreenshotTimelineMarker";

const BAR_SLOT = 6;
const MIN_BARS = 48;
const MAX_BARS = 220;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 48;
const ACTIVE_WINDOW_MS = 450;

type Props = {
  screenshots?: ScreenshotCue[];
  selectedScreenshotId?: string | null;
  onScreenshotSelect?: (id: string) => void;
};

function ratioFromEvent(element: HTMLElement, clientX: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function AudioWaveform({
  screenshots = [],
  selectedScreenshotId,
  onScreenshotSelect,
}: Props) {
  const { src, currentTime, duration, seek } = useAudioPlayer();
  const peaks = useWaveformPeaks(src);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [barCount, setBarCount] = useState(96);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const progress = duration > 0 ? currentTime / duration : 0;
  const heights = useMemo(() => downsamplePeaks(peaks ?? new Float32Array(0), barCount), [peaks, barCount]);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) {
      return;
    }
    const update = () => {
      const next = Math.min(MAX_BARS, Math.max(MIN_BARS, Math.floor(node.clientWidth / BAR_SLOT)));
      setBarCount(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const seekFromEvent = (clientX: number) => {
    if (!trackRef.current || duration <= 0) {
      return;
    }
    seek(ratioFromEvent(trackRef.current, clientX) * duration);
  };

  return (
    <div className="waveform">
      {screenshots.length > 0 ? (
        <div className="waveform-cues">
          {screenshots.map((cue) => (
            <ScreenshotTimelineMarker
              key={cue.id}
              cue={cue}
              duration={duration}
              selected={cue.id === selectedScreenshotId}
              active={Math.abs(currentTime * 1000 - cue.timestampMs) <= ACTIVE_WINDOW_MS}
              onSelect={(id, seconds) => {
                seek(seconds);
                onScreenshotSelect?.(id);
              }}
            />
          ))}
        </div>
      ) : null}

      <div
        ref={trackRef}
        className="waveform-track"
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
          if (!trackRef.current) {
            return;
          }
          const next = ratioFromEvent(trackRef.current, event.clientX);
          setHoverRatio(next);
          if (dragging.current) {
            seekFromEvent(event.clientX);
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerLeave={() => {
          if (!dragging.current) {
            setHoverRatio(null);
          }
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
        {heights.map((value, index) => (
          <span
            key={index}
            className={`waveform-bar ${(index + 0.5) / barCount <= progress ? "is-played" : ""}`}
            style={{ height: `${MIN_HEIGHT + value * (MAX_HEIGHT - MIN_HEIGHT)}px` }}
          />
        ))}
        {hoverRatio != null ? (
          <span className="waveform-scrub" style={{ left: `${hoverRatio * 100}%` }}>
            <span className="waveform-scrub-time">{formatTimestamp(hoverRatio * duration * 1000)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
