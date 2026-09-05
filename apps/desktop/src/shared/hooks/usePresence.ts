import { useEffect, useState } from "react";

function motionMs(duration: number) {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

export function usePresence(open: boolean, duration = 180) {
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setPresent(false), motionMs(duration));
    return () => window.clearTimeout(timer);
  }, [open, duration]);

  return { present, entered };
}
