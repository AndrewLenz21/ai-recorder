import type { ReactNode } from "react";

import { Toast } from "@/shared/components/Toast";

import { ThemeToggle } from "../components/ThemeToggle";

type Props = {
  children: ReactNode;
  wide?: boolean;
};

export function MainLayout({ children, wide = false }: Props) {
  return (
    <div className={`app-shell ${wide ? "is-wide" : ""}`}>
      <div className="window-drag-region" data-tauri-drag-region />
      <ThemeToggle />
      <div className={`app-frame ${wide ? "is-wide" : ""}`}>{children}</div>
      <Toast />
    </div>
  );
}
