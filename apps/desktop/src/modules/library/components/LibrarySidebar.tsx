import { ChevronRightIcon, PlusIcon } from "@/shared/components/icons";
import type { RecordingFolder } from "@/tauri/types";

import { FolderGlyph } from "./FolderGlyph";
import { FolderTree } from "./FolderTree";

type Props = {
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  collapsed?: boolean;
  onSelectAll: () => void;
  onSelectFolder: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onCreateSubfolder: (folder: RecordingFolder) => void;
  onEditFolder: (folder: RecordingFolder) => void;
  onToggleCollapsed?: () => void;
};

export function LibrarySidebar({
  selectedFolderId,
  expandedIds,
  collapsed = false,
  onSelectAll,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onCreateSubfolder,
  onEditFolder,
  onToggleCollapsed,
}: Props) {
  return (
    <aside className={`library-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="library-sidebar-top">
        <button
          type="button"
          className={`folder-tree-item is-gray ${selectedFolderId ? "" : "is-selected"} ${collapsed ? "is-collapsed" : ""}`}
          data-tip={collapsed ? "All Recordings" : undefined}
          onClick={onSelectAll}
        >
          <span className="folder-tree-button">
            <span className="folder-mark is-small is-gray">
              <FolderGlyph icon="all" size={14} />
            </span>
            {collapsed ? null : <span className="folder-tree-name">All Recordings</span>}
          </span>
        </button>
        {onToggleCollapsed ? (
          <button
            type="button"
            className={`library-sidebar-toggle ${collapsed ? "is-collapsed" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            <ChevronRightIcon size={16} />
          </button>
        ) : null}
      </div>

      <div className="library-sidebar-folders">
        {collapsed ? null : (
          <div className="library-sidebar-heading">
            <p className="folder-field-label">Folders</p>
            <button
              type="button"
              className="icon-btn library-sidebar-add"
              aria-label="Add folder"
              onClick={() => onCreateFolder(null)}
            >
              <PlusIcon size={16} />
            </button>
          </div>
        )}
        <FolderTree
          selectedFolderId={selectedFolderId}
          expandedIds={expandedIds}
          collapsed={collapsed}
          onSelect={onSelectFolder}
          onToggle={onToggleFolder}
          onCreateSubfolder={onCreateSubfolder}
          onEdit={onEditFolder}
        />
      </div>
    </aside>
  );
}
