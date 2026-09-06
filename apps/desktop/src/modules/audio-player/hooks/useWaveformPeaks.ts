import { useEffect, useState } from "react";

import { loadWaveformPeaks } from "../waveform";

export function useWaveformPeaks(src: string | null) {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (!src) {
      setPeaks(null);
      return;
    }
    let cancelled = false;
    void loadWaveformPeaks(src).then((next) => {
      if (!cancelled) {
        setPeaks(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return peaks;
}
