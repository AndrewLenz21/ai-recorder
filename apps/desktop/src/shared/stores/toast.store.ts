import { create } from "zustand";

export type ToastKind = "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
};

type ToastStore = {
  toast: Toast | null;
  visible: boolean;
  show: (kind: ToastKind, title: string, detail?: string) => void;
  hide: () => void;
  clear: () => void;
};

let nextId = 1;
let hideTimer = 0;
let clearTimer = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  visible: false,
  show: (kind, title, detail) => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(clearTimer);
    set({ toast: { id: nextId, kind, title, detail }, visible: true });
    nextId += 1;
    hideTimer = window.setTimeout(() => {
      useToastStore.getState().hide();
    }, 3200);
  },
  hide: () => {
    set({ visible: false });
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => {
      useToastStore.setState({ toast: null });
    }, 200);
  },
  clear: () => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(clearTimer);
    set({ toast: null, visible: false });
  },
}));

export function showToast(kind: ToastKind, title: string, detail?: string) {
  useToastStore.getState().show(kind, title, detail);
}
