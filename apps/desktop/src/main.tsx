import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { hydrateTheme } from "@/app/theme/useTheme";
import { FloatingWidget } from "@/modules/floating-widget";

import "@/app/styles/tokens.css";
import "@/app/styles/global.css";

hydrateTheme();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element missing");
}

const isWidget = getCurrentWindow().label === "widget";
document.documentElement.classList.toggle("widget-window", isWidget);

createRoot(root).render(
  <StrictMode>
    {isWidget ? <FloatingWidget /> : <App />}
  </StrictMode>,
);
