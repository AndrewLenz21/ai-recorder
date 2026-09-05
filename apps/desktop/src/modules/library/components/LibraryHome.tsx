import { useMemo, useState } from "react";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { SectionAction } from "@/shared/components/SectionAction";
import {
  AudioBarsIcon,
  ChevronRightIcon,
  ClockIcon,
  PlusIcon,
  RecordIcon,
  StarIcon,
} from "@/shared/components/icons";
import { formatBytes, formatDateTime, formatSpan, formatTimestamp } from "@/shared/lib/time";
import { useRecorder } from "@/modules/recorder";
import type { FolderColor, FolderIcon, RecordingFolder } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { recordingTitle } from "../utils/recordings";
import { DestinationPicker } from "./DestinationPicker";
import { FolderEditor } from "./FolderEditor";
import { FolderGlyph } from "./FolderGlyph";
import { FolderOptions } from "./FolderOptions";
import { RecordingOptions } from "./RecordingOptions";

export function LibraryHome() {
  const { start, openSession, error: recorderError } = useRecorder();
  const {
    folders,
    recordings,
    folderCounts,
    error,
    defaultFolderId,
    setRoute,
    createFolder,
    updateFolder,
    setDefaultFolder,
  } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecordingFolder | null>(null);

  const recents = useMemo(() => recordings.slice(0, 4), [recordings]);
  const stats = useMemo(() => {
    const durationMs = recordings.reduce((sum, item) => sum + item.durationMs, 0);
    const usedBytes = recordings.reduce((sum, item) => sum + item.fileSizeBytes, 0);
    return { durationMs, usedBytes };
  }, [recordings]);

  const saveCreate = async (name: string, icon: FolderIcon, color: FolderColor) => {
    if (await createFolder(name, icon, color)) {
      setCreating(false);
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

  const summary = [
    `${recordings.length} recording${recordings.length === 1 ? "" : "s"}`,
    recordings.length > 0 ? formatSpan(stats.durationMs) : null,
    stats.usedBytes > 0 ? formatBytes(stats.usedBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="library library-home">
      {recorderError || error ? <p className="error-text">{recorderError || error}</p> : null}

      <div className="dashboard-hero">
        <p className="eyebrow">AI Recorder</p>
        <h1>Ready when you are.</h1>
        {recordings.length > 0 ? <p className="dashboard-summary">{summary}</p> : null}
        <Button variant="record" size="lg" onClick={() => void start()}>
          <RecordIcon />
          Start recording
        </Button>
        <DestinationPicker />
      </div>

      <div className="dashboard-columns">
        <section className="library-section folders-section">
          <div className="section-heading">
            <h2 className="section-label">
              <FolderGlyph icon="folder" size={16} />
              Folders
            </h2>
            <SectionAction
              label="Add folder"
              icon={<PlusIcon size={18} />}
              onClick={() => setCreating(true)}
            />
          </div>
          <Modal open={creating} title="Create Folder" onClose={() => setCreating(false)}>
            <FolderEditor variant="dialog" onSave={saveCreate} onClose={() => setCreating(false)} />
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
          {folders.length === 0 ? (
            <p className="muted">Create a folder to keep recordings organized.</p>
          ) : (
            <div className="folder-column-list">
              {folders.map((folder) => {
                const count = folderCounts.get(folder.id) ?? 0;
                const isDefault = folder.id === defaultFolderId;
                return (
                  <div key={folder.id} className="folder-row">
                    <button
                      type="button"
                      className="folder-cell"
                      onClick={() => setRoute({ name: "folder", folderId: folder.id })}
                    >
                      <span className={`folder-mark is-${folder.color}`}>
                        <FolderGlyph icon={folder.icon} />
                      </span>
                      <span className="library-row-copy">
                        <strong>
                          {folder.name}
                          {isDefault ? (
                            <span className="folder-star" title="Default folder" aria-label="Default folder">
                              <StarIcon size={11} />
                            </span>
                          ) : null}
                        </strong>
                        <span>{count === 1 ? "1 recording" : `${count} recordings`}</span>
                      </span>
                    </button>
                    <FolderOptions
                      folder={folder}
                      isDefault={isDefault}
                      onEdit={() => setEditing(folder)}
                      onSetDefault={() => void setDefaultFolder(folder.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="library-section recent-section">
          <div className="section-heading">
            <h2 className="section-label">
              <ClockIcon size={16} />
              Recent
            </h2>
            {recordings.length > 0 ? (
              <SectionAction
                label="View all"
                icon={<ChevronRightIcon size={18} />}
                onClick={() => setRoute({ name: "all" })}
              />
            ) : null}
          </div>
          {recents.length === 0 ? (
            <p className="muted">New recordings will appear here.</p>
          ) : (
            <ul className="recording-list">
              {recents.map((item) => (
                <li key={item.id}>
                  <div className="recent-item">
                    <button type="button" className="recording-main is-recent" onClick={() => void openSession(item.id)}>
                      <span className="row-lead">
                        <AudioBarsIcon size={16} />
                      </span>
                      <span className="library-row-copy">
                        <strong>{recordingTitle(item)}</strong>
                        <span>
                          {formatDateTime(item.startedAt)} · {formatTimestamp(item.durationMs)}
                        </span>
                      </span>
                    </button>
                    <RecordingOptions recording={item} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
