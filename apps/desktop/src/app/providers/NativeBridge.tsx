import { listen } from "@tauri-apps/api/event";
import { useEffect, type ReactNode } from "react";

import { recorderService, useRecorderStore } from "@/modules/recorder";
import { NativeEvents } from "@/tauri/events";
import type { RecorderStateDto } from "@/tauri/types";

type Props = {
  children: ReactNode;
};

export function NativeBridge({ children }: Props) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const state = await recorderService.getState();
      if (!disposed) {
        useRecorderStore.getState().hydrate(state);
      }
      unlisten = await listen<RecorderStateDto>(NativeEvents.recorderState, (event) => {
        useRecorderStore.getState().hydrate(event.payload);
      });
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return children;
}
