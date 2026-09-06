const PEAK_BINS = 2048;
const cache = new Map<string, Promise<Float32Array>>();

type WavInfo = {
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
};

function readFourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseWav(buffer: ArrayBuffer): WavInfo | null {
  if (buffer.byteLength < 44) {
    return null;
  }
  const view = new DataView(buffer);
  if (readFourCC(view, 0) !== "RIFF" || readFourCC(view, 8) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const id = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "fmt " && size >= 16) {
      channels = Math.max(1, view.getUint16(start + 2, true));
      bitsPerSample = view.getUint16(start + 14, true);
    } else if (id === "data") {
      dataOffset = start;
      dataSize = size;
      break;
    }
    offset = start + size + (size % 2);
  }

  if (!dataOffset || !dataSize) {
    return null;
  }
  return { channels, bitsPerSample, dataOffset, dataSize };
}

function sampleAmplitude(view: DataView, index: number, bitsPerSample: number) {
  if (bitsPerSample === 16) {
    return Math.abs(view.getInt16(index, true)) / 32768;
  }
  if (bitsPerSample === 8) {
    return Math.abs(view.getUint8(index) - 128) / 128;
  }
  if (bitsPerSample === 32) {
    return Math.min(1, Math.abs(view.getFloat32(index, true)));
  }
  return 0;
}

function peaksFromWav(buffer: ArrayBuffer): Float32Array | null {
  const wav = parseWav(buffer);
  if (!wav || (wav.bitsPerSample !== 8 && wav.bitsPerSample !== 16 && wav.bitsPerSample !== 32)) {
    return null;
  }

  const bytesPerSample = wav.bitsPerSample / 8;
  const frameSize = bytesPerSample * wav.channels;
  if (frameSize <= 0) {
    return null;
  }

  const view = new DataView(buffer);
  const frames = Math.floor(wav.dataSize / frameSize);
  if (frames <= 0) {
    return null;
  }

  const peaks = new Float32Array(PEAK_BINS);
  const dataEnd = Math.min(view.byteLength, wav.dataOffset + wav.dataSize);

  for (let bin = 0; bin < PEAK_BINS; bin += 1) {
    const start = Math.floor((bin * frames) / PEAK_BINS);
    const end = Math.max(start + 1, Math.floor(((bin + 1) * frames) / PEAK_BINS));
    const step = Math.max(1, Math.floor((end - start) / 64));
    let max = 0;
    for (let frame = start; frame < end; frame += step) {
      const base = wav.dataOffset + frame * frameSize;
      if (base + frameSize > dataEnd) {
        break;
      }
      for (let channel = 0; channel < wav.channels; channel += 1) {
        max = Math.max(max, sampleAmplitude(view, base + channel * bytesPerSample, wav.bitsPerSample));
      }
    }
    peaks[bin] = max;
  }

  let loudest = 0;
  for (let i = 0; i < peaks.length; i += 1) {
    loudest = Math.max(loudest, peaks[i] ?? 0);
  }
  if (loudest > 0) {
    for (let i = 0; i < peaks.length; i += 1) {
      peaks[i] = Math.pow((peaks[i] ?? 0) / loudest, 0.62);
    }
  }
  return peaks;
}

async function extractPeaks(src: string) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("waveform fetch failed");
  }
  const buffer = await response.arrayBuffer();
  return peaksFromWav(buffer) ?? new Float32Array(0);
}

export function loadWaveformPeaks(src: string) {
  const cached = cache.get(src);
  if (cached) {
    return cached;
  }
  const request = extractPeaks(src).catch(() => new Float32Array(0));
  cache.set(src, request);
  return request;
}

export function downsamplePeaks(peaks: Float32Array, count: number) {
  const bars = new Array<number>(count);
  if (count <= 0) {
    return bars;
  }
  if (peaks.length === 0) {
    bars.fill(0.12);
    return bars;
  }
  const ratio = peaks.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let max = 0;
    for (let j = start; j < end; j += 1) {
      max = Math.max(max, peaks[j] ?? 0);
    }
    bars[i] = Math.max(0.08, max);
  }
  return bars;
}
