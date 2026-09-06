import type { RecordingFolder } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { childFolders } from "../utils/folders";
import { FolderTreeItem } from "./FolderTreeItem";

type Props = {
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreateSubfolder: (folder: RecordingFolder) => void;
  onEdit: (folder: RecordingFolder) => void;
};

export function FolderTree({
  selectedFolderId,
  expandedIds,
  collapsed = false,
  onSelect,
  onToggle,
  onCreateSubfolder,
  onEdit,
}: Props) {
  const { folders } = useLibrary();
  const roots = childFolders(folders, null);

  if (roots.length === 0) {
    return collapsed ? null : <p className="folder-tree-empty">No folders yet.</p>;
  }

  return (
    <ul className="folder-tree">
      {roots.map((folder) => (
        <FolderTreeItem
          key={folder.id}
          folder={folder}
          depth={0}
          selectedFolderId={selectedFolderId}
          expandedIds={expandedIds}
          collapsed={collapsed}
          onSelect={onSelect}
          onToggle={onToggle}
          onCreateSubfolder={onCreateSubfolder}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}
