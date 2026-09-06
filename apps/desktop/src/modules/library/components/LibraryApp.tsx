import { useLibrary, useLibraryHydration } from "../hooks/useLibrary";
import { SettingsView } from "@/modules/settings/components/SettingsView";

import { LibraryBrowse } from "./LibraryBrowse";
import { LibraryHome } from "./LibraryHome";
import { LibrarySwitch } from "./LibrarySwitch";

export function LibraryApp() {
  useLibraryHydration();
  const { route } = useLibrary();
  const pane =
    route.name === "folder"
      ? route.folderId
      : route.name === "all"
        ? "all"
        : route.name === "settings"
          ? "settings"
          : "root";
  const browsing = route.name === "all" || route.name === "folder";

  return (
    <div className={`flex flex-col ${browsing ? "gap-4" : "gap-7"}`}>
      <LibrarySwitch />
      <div className="library-pane" key={pane}>
        {browsing ? (
          <LibraryBrowse />
        ) : route.name === "settings" ? (
          <SettingsView />
        ) : (
          <LibraryHome />
        )}
      </div>
    </div>
  );
}
