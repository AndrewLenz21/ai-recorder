import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/shared/components/Modal";
import { FolderGlyph } from "./FolderGlyph";
import type { FolderColor, FolderIcon, RecordingFolder } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { useLibraryBrowser } from "../hooks/useLibraryBrowser";
import { childFolders, folderPath } from "../utils/folders";
import { FolderContentRow } from "./FolderContentRow";
import { FolderEditor } from "./FolderEditor";
import { LibraryGridFolder, LibraryGridRecording } from "./LibraryGridItem";
import { LibrarySidebar } from "./LibrarySidebar";
import { LibraryTypeFilter } from "./LibraryTypeFilter";
import { RecordingRow } from "./RecordingRow";
import { SortMenu } from "./SortMenu";
import { ViewModeToggle } from "./ViewModeToggle";

const COMPACT = "(max-width: 800px)";
const EXPANDED_KEY = "ai-recorder.folder-expanded";
const COLLAPSED_KEY = "ai-recorder.library-sidebar-collapsed";

function readExpanded() {
  try {
    const stored = window.localStorage.getItem(EXPANDED_KEY);
    const parsed = stored ? (JSON.parse(stored) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function LibraryBrowse() {
  const {
    folders,
    visibleRecordings,
    route,
    sort,
    error,
    currentFolder,
    setRoute,
    setSort,
    createFolder,
    updateFolder,
    setDefaultFolder,
  } = useLibrary();
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(readExpanded);
  const [creatingParent, setCreatingParent] = useState<RecordingFolder | null | "root">(null);
  const [editing, setEditing] = useState<RecordingFolder | null>(null);
  const { mode, showFolders, showRecordings, setMode, setTypes } = useLibraryBrowser();

  const selectedFolderId = route.name === "folder" ? route.folderId : null;
  const path = currentFolder ? folderPath(folders, currentFolder.id) : [];
  const creating = creatingParent !== null;
  const parentFolder = creatingParent && creatingParent !== "root" ? creatingParent : null;

  useEffect(() => {
    const media = window.matchMedia(COMPACT);
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!selectedFolderId) {
      return;
    }
    const ancestors = folderPath(folders, selectedFolderId).slice(0, -1);
    if (ancestors.length === 0) {
      return;
    }
    setExpandedIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const folder of ancestors) {
        if (!next.has(folder.id)) {
          next.add(folder.id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [folders, selectedFolderId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedIds]));
    } catch {
      // Ignore private-mode storage errors.
    }
  }, [expandedIds]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Ignore private-mode storage errors.
      }
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setRoute({ name: "all" });
    setDrawerOpen(false);
  };

  const selectFolder = (id: string) => {
    setRoute({ name: "folder", folderId: id });
    setDrawerOpen(false);
  };

  const openCreate = (parent: RecordingFolder | null) => {
    setCreatingParent(parent ?? "root");
    if (parent) {
      setExpandedIds((current) => new Set(current).add(parent.id));
    }
  };

  const saveCreate = async (name: string, icon: FolderIcon, color: FolderColor, setAsDefault: boolean) => {
    const parentId = parentFolder?.id ?? null;
    const created = await createFolder(name, icon, color, parentId);
    if (created) {
      if (setAsDefault) {
        await setDefaultFolder(created.id);
      }
      setCreatingParent(null);
    }
  };

  const saveEdit = async (name: string, icon: FolderIcon, color: FolderColor) => {
    if (!editing) {
      return;
    }
    if (await updateFolder(editing.id, name, icon, color)) {
      setEditing(null);
    }
  };

  const title = currentFolder?.name ?? "All Recordings";
  const breadcrumb = useMemo(() => path.slice(0, -1).map((folder) => folder.name).join(" › "), [path]);
  const nestedFolders = useMemo(
    () =>
      currentFolder
        ? [...childFolders(folders, currentFolder.id)].sort((left, right) =>
            left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
          )
        : [],
    [currentFolder, folders],
  );
  const shownFolders = showFolders ? nestedFolders : [];
  const shownRecordings = showRecordings ? visibleRecordings : [];
  const actuallyEmpty = nestedFolders.length === 0 && visibleRecordings.length === 0;
  const filteredEmpty = !actuallyEmpty && shownFolders.length === 0 && shownRecordings.length === 0;
  const emptyText = currentFolder ? "This folder is empty." : "No recordings yet.";

  const sidebar = (
    <LibrarySidebar
      selectedFolderId={selectedFolderId}
      expandedIds={expandedIds}
      collapsed={!compact && collapsed}
      onSelectAll={selectAll}
      onSelectFolder={selectFolder}
      onToggleFolder={toggleFolder}
      onCreateFolder={(parentId) => {
        const parent = parentId ? folders.find((folder) => folder.id === parentId) ?? null : null;
        openCreate(parent);
      }}
      onCreateSubfolder={openCreate}
      onEditFolder={setEditing}
      onToggleCollapsed={compact ? undefined : toggleCollapsed}
    />
  );

  return (
    <section className={`library-browse ${!compact && collapsed ? "is-collapsed" : ""} ${compact ? "is-compact" : ""}`}>
      {compact ? (
        <button type="button" className="library-browse-nav" onClick={() => setDrawerOpen(true)}>
          <FolderGlyph icon="folder" size={16} />
          Folders
        </button>
      ) : (
        sidebar
      )}

      {compact && drawerOpen ? (
        <div className="library-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <div className="library-drawer" onMouseDown={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="library-browse-main">
        <header className="library-browse-header">
          <div className="collection-title">
            {currentFolder ? (
              <span className={`folder-mark is-${currentFolder.color}`}>
                <FolderGlyph icon={currentFolder.icon} />
              </span>
            ) : (
              <span className="folder-mark is-gray">
                <FolderGlyph icon="all" />
              </span>
            )}
            <div className="library-browse-titles">
              {breadcrumb ? <p className="library-browse-crumb">{breadcrumb}</p> : null}
              <h1>{title}</h1>
            </div>
          </div>
          <div className="library-browse-tools">
            <LibraryTypeFilter
              showFolders={showFolders}
              showRecordings={showRecordings}
              onChange={setTypes}
            />
            <SortMenu value={sort} onChange={setSort} />
            <ViewModeToggle value={mode} onChange={setMode} />
          </div>
        </header>

        {error ? <p className="error-text">{error}</p> : null}

        {actuallyEmpty ? (
          <p className="muted collection-empty">{emptyText}</p>
        ) : filteredEmpty ? (
          <div className="collection-empty">
            <p className="muted">
              {showFolders ? "No recordings in this location." : "No folders in this location."}
            </p>
            <button
              type="button"
              className="ghost-link"
              onClick={() => setTypes(!showFolders, !showRecordings)}
            >
              {showFolders ? "Show recordings" : "Show folders"}
            </button>
          </div>
        ) : (
          <div key={mode} className="library-browser-body">
            {mode === "grid" ? (
              <div className="library-grid">
                {shownFolders.map((folder) => (
                  <LibraryGridFolder
                    key={folder.id}
                    folder={folder}
                    onOpen={() => selectFolder(folder.id)}
                    onEdit={() => setEditing(folder)}
                  />
                ))}
                {shownRecordings.map((item) => (
                  <LibraryGridRecording key={item.id} recording={item} />
                ))}
              </div>
            ) : (
              <ul className="recording-list">
                {shownFolders.map((folder) => (
                  <li key={folder.id}>
                    <FolderContentRow
                      folder={folder}
                      onOpen={() => selectFolder(folder.id)}
                      onEdit={() => setEditing(folder)}
                    />
                  </li>
                ))}
                {shownRecordings.map((item) => (
                  <li key={item.id}>
                    <RecordingRow recording={item} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Modal
        open={creating}
        title={parentFolder ? `New folder inside “${parentFolder.name}”` : "New folder"}
        onClose={() => setCreatingParent(null)}
      >
        <FolderEditor variant="dialog" onSave={saveCreate} onClose={() => setCreatingParent(null)} />
      </Modal>
      <Modal open={Boolean(editing)} title="Edit Folder" onClose={() => setEditing(null)}>
        {editing ? (
          <FolderEditor
            variant="dialog"
            folder={editing}
            onSave={saveEdit}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </section>
  );
}
