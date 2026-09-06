import { AudioBarsIcon } from "@/shared/components/icons";
import type { RecordingFolder } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { childFolders } from "../utils/folders";
import { FolderGlyph } from "./FolderGlyph";
import { FolderOptions } from "./FolderOptions";
import { ItemMeta } from "./ItemMeta";

type Props = {
  folder: RecordingFolder;
  onOpen: () => void;
  onEdit: () => void;
};

export function FolderContentRow({ folder, onOpen, onEdit }: Props) {
  const { folders, folderCounts, defaultFolderId, setDefaultFolder, deleteFolder } = useLibrary();
  const nested = childFolders(folders, folder.id).length;
  const recordings = folderCounts.get(folder.id) ?? 0;

  return (
    <div className="recent-item">
      <button type="button" className="recording-main is-recent" onClick={onOpen}>
        <span className="row-lead">
          <span className={`folder-mark is-small is-${folder.color}`}>
            <FolderGlyph icon={folder.icon} size={14} />
          </span>
        </span>
        <span className="library-row-copy">
          <strong>{folder.name}</strong>
          <span className="library-tile-meta">
            <ItemMeta icon={<FolderGlyph icon="folder" size={12} />} value={nested} />
            <ItemMeta icon={<AudioBarsIcon size={12} />} value={recordings} />
          </span>
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
