import { ChevronRightIcon } from "@/shared/components/icons";
import type { RecordingFolder } from "@/tauri/types";

import { useLibrary } from "../hooks/useLibrary";
import { childFolders } from "../utils/folders";
import { FolderGlyph } from "./FolderGlyph";
import { FolderOptions } from "./FolderOptions";

type Props = {
  folder: RecordingFolder;
  depth: number;
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreateSubfolder: (folder: RecordingFolder) => void;
  onEdit: (folder: RecordingFolder) => void;
};

export function FolderTreeItem({
  folder,
  depth,
  selectedFolderId,
  expandedIds,
  collapsed = false,
  onSelect,
  onToggle,
  onCreateSubfolder,
  onEdit,
}: Props) {
  const { folders, defaultFolderId, setDefaultFolder, deleteFolder } = useLibrary();
  const children = childFolders(folders, folder.id);
  const expanded = expandedIds.has(folder.id);
  const selected = selectedFolderId === folder.id;
  const isDefault = folder.id === defaultFolderId;

  return (
    <li>
      <div
        className={`folder-tree-item is-${folder.color} ${selected ? "is-selected" : ""} ${collapsed ? "is-collapsed" : ""}`}
        data-tip={collapsed ? folder.name : undefined}
        style={collapsed ? undefined : { paddingLeft: 6 + depth * 14 }}
      >
        {children.length > 0 && !collapsed ? (
          <button
            type="button"
            className={`folder-tree-lead ${expanded ? "is-open" : ""}`}
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(folder.id);
            }}
          >
            <span className={`folder-mark is-small is-${folder.color}`}>
              <FolderGlyph icon={folder.icon} size={14} />
            </span>
            <span className="folder-tree-chevron">
              <ChevronRightIcon size={14} />
            </span>
          </button>
        ) : null}
        <button type="button" className="folder-tree-button" onClick={() => onSelect(folder.id)}>
          {children.length > 0 && !collapsed ? null : (
            <span className={`folder-mark is-small is-${folder.color}`}>
              <FolderGlyph icon={folder.icon} size={14} />
            </span>
          )}
          {collapsed ? null : <span className="folder-tree-name">{folder.name}</span>}
        </button>
        {collapsed ? null : (
          <FolderOptions
            folder={folder}
            isDefault={isDefault}
            onEdit={() => onEdit(folder)}
            onSetDefault={() => void setDefaultFolder(folder.id)}
            onNewSubfolder={() => onCreateSubfolder(folder)}
            onDelete={() => void deleteFolder(folder.id)}
          />
        )}
      </div>
      {collapsed || children.length === 0 ? null : (
        <div className={`folder-tree-children ${expanded ? "is-open" : ""}`}>
          <ul>
            {children.map((child) => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
                onCreateSubfolder={onCreateSubfolder}
                onEdit={onEdit}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
