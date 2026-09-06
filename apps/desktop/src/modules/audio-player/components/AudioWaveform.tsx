import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { formatTimestamp } from "@/shared/lib/time";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useWaveformPeaks } from "../hooks/useWaveformPeaks";
import type { ScreenshotCue } from "../types";
import { downsamplePeaks } from "../waveform";
import { ScreenshotTimelineMarker } from "./ScreenshotTimelineMarker";

const BAR_SLOT = 6;
const MIN_BARS = 48;
const MAX_BARS = 220;
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

function WaveformLane({
  src,
  compact,
  progress,
  barCount,
  trackRef,
  hoverRatio,
  duration,
  currentTime,
  onSeek,
  onHover,
}: {
  src: string | null;
  compact: boolean;
  progress: number;
  barCount: number;
  trackRef?: RefObject<HTMLDivElement | null>;
  hoverRatio: number | null;
  duration: number;
  currentTime: number;
  onSeek: (clientX: number) => void;
  onHover: (ratio: number | null) => void;
}) {
  const peaks = useWaveformPeaks(src);
  const minHeight = compact ? 4 : 6;
  const maxHeight = compact ? 28 : 48;
  const heights = useMemo(() => downsamplePeaks(peaks ?? new Float32Array(0), barCount), [peaks, barCount]);
  const dragging = useRef(false);

  return (
    <div
      ref={trackRef}
      className={`waveform-track ${compact ? "is-compact" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(event.clientX);
      }}
      onPointerMove={(event) => {
        const target = trackRef?.current ?? event.currentTarget;
        onHover(ratioFromEvent(target, event.clientX));
        if (dragging.current) {
          onSeek(event.clientX);
        }
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        if (!dragging.current) {
          onHover(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
        }
      }}
    >
      {heights.map((value, index) => (
        <span
          key={index}
          className={`waveform-bar ${(index + 0.5) / barCount <= progress ? "is-played" : ""}`}
          style={{ height: `${minHeight + value * (maxHeight - minHeight)}px` }}
        />
      ))}
      {hoverRatio != null ? (
        <span className="waveform-scrub" style={{ left: `${hoverRatio * 100}%` }}>
          <span className="waveform-scrub-time">{formatTimestamp(hoverRatio * duration * 1000)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function AudioWaveform({
  screenshots = [],
  selectedScreenshotId,
  onScreenshotSelect,
}: Props) {
  const { src, tracks, currentTime, duration, seek } = useAudioPlayer();
  const trackRef = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState(96);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const progress = duration > 0 ? currentTime / duration : 0;
  const stacked = tracks.length > 1;

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
  }, [stacked]);

  const seekFromEvent = (clientX: number) => {
    const node = trackRef.current;
    if (!node || duration <= 0) {
      return;
    }
    seek(ratioFromEvent(node, clientX) * duration);
  };

  return (
    <div
      className="waveform"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          seek(currentTime + 5);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          seek(currentTime - 5);
        }
      }}
    >
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

      {stacked ? (
        <div className="waveform-stack">
          {tracks.map((track, index) => (
            <div key={track.id} className="waveform-lane">
              <span className="waveform-lane-label">{track.label}</span>
              <WaveformLane
                src={track.src}
                compact
                progress={progress}
                barCount={barCount}
                trackRef={index === 0 ? trackRef : undefined}
                hoverRatio={hoverRatio}
                duration={duration}
                currentTime={currentTime}
                onSeek={seekFromEvent}
                onHover={setHoverRatio}
              />
            </div>
          ))}
        </div>
      ) : (
        <WaveformLane
          src={src}
          compact={false}
          progress={progress}
          barCount={barCount}
          trackRef={trackRef}
          hoverRatio={hoverRatio}
          duration={duration}
          currentTime={currentTime}
          onSeek={seekFromEvent}
          onHover={setHoverRatio}
        />
      )}
    </div>
  );
}
