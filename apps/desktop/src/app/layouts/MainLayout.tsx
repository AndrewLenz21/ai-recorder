import type { ReactNode } from "react";

import { ThemeToggle } from "../components/ThemeToggle";

type Props = {
  children: ReactNode;
};

export function MainLayout({ children }: Props) {
  return (
    <div className="app-shell">
      <div className="window-drag-region" data-tauri-drag-region />
      <ThemeToggle />
      <div className="app-frame">{children}</div>
    </div>
  );
}
