import { useState } from "react";

import { formatDateTime, formatTimestamp } from "@/shared/lib/time";
import { useRecorder } from "@/modules/recorder";
import type { FolderColor, FolderIcon } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { recordingTitle } from "../utils/recordings";
import { FolderEditor } from "./FolderEditor";
import { FolderGlyph } from "./FolderGlyph";
import { MoveMenu } from "./MoveMenu";
import { SortMenu } from "./SortMenu";

export function CollectionView() {
  const { openSession } = useRecorder();
  const {
    folders,
    visibleRecordings,
    route,
    sort,
    error,
    currentFolder,
    setRoute,
    setSort,
    updateFolder,
    deleteFolder,
    moveRecording,
  } = useLibrary();
  const [editing, setEditing] = useState(false);

  const title = route.name === "all" ? "All Recordings" : currentFolder?.name ?? "Folder";
  const isFolder = route.name === "folder";

  const save = async (name: string, icon: FolderIcon, color: FolderColor) => {
    if (!currentFolder) {
      return;
    }
    if (await updateFolder(currentFolder.id, name, icon, color)) {
      setEditing(false);
    }
  };

  return (
    <section className="library library-collection">
      {isFolder ? (
        <button type="button" className="library-back" onClick={() => setRoute({ name: "root" })}>
          ← Dashboard
        </button>
      ) : null}

      <header className="collection-header">
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
          <h1>{title}</h1>
        </div>
        <div className="collection-tools">
          <SortMenu value={sort} onChange={setSort} />
          {isFolder && currentFolder ? (
            <button type="button" className="ghost-link" onClick={() => setEditing((value) => !value)}>
              {editing ? "Close" : "Edit"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {editing && currentFolder ? (
        <FolderEditor
          folder={currentFolder}
          onSave={save}
          onDelete={async () => {
            await deleteFolder(currentFolder.id);
          }}
          onClose={() => setEditing(false)}
        />
      ) : null}

      {visibleRecordings.length === 0 ? (
        <p className="muted collection-empty">
          {isFolder ? "No recordings in this folder yet." : "No recordings yet."}
        </p>
      ) : (
        <ul className="recording-list">
          {visibleRecordings.map((item) => {
            const titleText = recordingTitle(item);
            const folder = folders.find((entry) => entry.id === item.folderId);
            const secondary = item.title?.trim()
              ? `${formatDateTime(item.startedAt)} · ${formatTimestamp(item.durationMs)}`
              : formatTimestamp(item.durationMs);
            const tertiary = [
              item.screenshotCount > 0
                ? `${item.screenshotCount} screenshot${item.screenshotCount === 1 ? "" : "s"}`
                : null,
              route.name === "all" && folder ? folder.name : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={item.id}>
                <div className="recording-row">
                  <button type="button" className="recording-main" onClick={() => void openSession(item.id)}>
                    <strong>{titleText}</strong>
                    <span>
                      {secondary}
                      {tertiary ? ` · ${tertiary}` : ""}
                    </span>
                  </button>
                  <MoveMenu
                    folders={folders}
                    currentFolderId={item.folderId}
                    onMove={(folderId) => void moveRecording(item.id, folderId)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
