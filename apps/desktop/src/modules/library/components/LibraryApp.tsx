import { useLibrary, useLibraryHydration } from "../hooks/useLibrary";
import { LibraryBrowse } from "./LibraryBrowse";
import { LibraryHome } from "./LibraryHome";
import { LibrarySwitch } from "./LibrarySwitch";
import { StorageView } from "./StorageView";

export function LibraryApp() {
  useLibraryHydration();
  const { route } = useLibrary();
  const pane =
    route.name === "folder"
      ? route.folderId
      : route.name === "all"
        ? "all"
        : route.name === "storage"
          ? "storage"
          : "root";
  const browsing = route.name === "all" || route.name === "folder";

  return (
    <div className={`flex flex-col ${browsing ? "gap-4" : "gap-7"}`}>
      <LibrarySwitch />
      <div className="library-pane" key={pane}>
        {browsing ? (
          <LibraryBrowse />
        ) : route.name === "storage" ? (
          <StorageView />
        ) : (
          <LibraryHome />
        )}
      </div>
    </div>
  );
}
