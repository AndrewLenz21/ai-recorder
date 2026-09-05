import { useLibrary, useLibraryHydration } from "../hooks/useLibrary";
import { CollectionView } from "./CollectionView";
import { LibraryHome } from "./LibraryHome";
import { LibrarySwitch } from "./LibrarySwitch";
import { StorageView } from "./StorageView";

export function LibraryApp() {
  useLibraryHydration();
  const { route } = useLibrary();
  const nested = route.name === "folder";
  const pane =
    route.name === "folder"
      ? route.folderId
      : route.name === "all"
        ? "all"
        : route.name === "storage"
          ? "storage"
          : "root";

  return (
    <div className={`library-shell ${nested ? "is-nested" : "is-root"}`}>
      {nested ? null : <LibrarySwitch />}
      <div className="library-pane" key={pane}>
        {route.name === "folder" ? (
          <CollectionView />
        ) : route.name === "all" ? (
          <CollectionView />
        ) : route.name === "storage" ? (
          <StorageView />
        ) : (
          <LibraryHome />
        )}
      </div>
    </div>
  );
}
