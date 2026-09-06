import { AudioBarsIcon, CaptureIcon, ClockIcon } from "@/shared/components/icons";
import { formatTimestamp } from "@/shared/lib/time";
import { useRecorder } from "@/modules/recorder";
import type { RecordingFolder, SessionSummary } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { childFolders } from "../utils/folders";
import { recordingTitle } from "../utils/recordings";
import { FolderGlyph } from "./FolderGlyph";
import { FolderOptions } from "./FolderOptions";
import { ItemMeta } from "./ItemMeta";
import { RecordingOptions } from "./RecordingOptions";

export function LibraryGridFolder({
  folder,
  onOpen,
  onEdit,
}: {
  folder: RecordingFolder;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const { folders, folderCounts, defaultFolderId, setDefaultFolder, deleteFolder } = useLibrary();
  const nested = childFolders(folders, folder.id).length;
  const recordings = folderCounts.get(folder.id) ?? 0;

  return (
    <div className="library-tile">
      <button type="button" className="library-tile-main" onClick={onOpen}>
        <span className="library-tile-head">
          <span className={`folder-mark is-small is-${folder.color}`}>
            <FolderGlyph icon={folder.icon} size={14} />
          </span>
          <strong>{folder.name}</strong>
        </span>
        <span className="library-tile-meta">
          <ItemMeta icon={<FolderGlyph icon="folder" size={12} />} value={nested} />
          <ItemMeta icon={<AudioBarsIcon size={12} />} value={recordings} />
        </span>
      </button>
      <FolderOptions
        folder={folder}
        isDefault={folder.id === defaultFolderId}
        onEdit={onEdit}
        onSetDefault={() => void setDefaultFolder(folder.id)}
        onDelete={() => void deleteFolder(folder.id)}
      />
    </div>
  );
}

export function LibraryGridRecording({ recording }: { recording: SessionSummary }) {
  const { openSession } = useRecorder();

  return (
    <div className="library-tile">
      <button type="button" className="library-tile-main" onClick={() => void openSession(recording.id)}>
        <span className="library-tile-head">
          <span className="recording-mark is-small">
            <AudioBarsIcon size={14} />
          </span>
          <strong>{recordingTitle(recording)}</strong>
        </span>
        <span className="library-tile-meta">
          <ItemMeta icon={<ClockIcon size={12} />} value={formatTimestamp(recording.durationMs)} />
          <ItemMeta icon={<CaptureIcon size={12} />} value={recording.screenshotCount} />
        </span>
      </button>
      <RecordingOptions recording={recording} />
    </div>
  );
}
