import { PencilIcon, TrashIcon } from "@/shared/components/icons";

import { FolderGlyph } from "./FolderGlyph";

type Props = {
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function RecordingActionsContent({ onMove, onRename, onDelete }: Props) {
  return (
    <div className="folder-actions">
      <button type="button" role="menuitem" className="folder-action" onClick={onMove}>
        <FolderGlyph icon="folder" size={16} />
        <span>Move to</span>
      </button>
      <button type="button" role="menuitem" className="folder-action" onClick={onRename}>
        <PencilIcon size={16} />
        <span>Rename</span>
      </button>
      <button type="button" role="menuitem" className="folder-action is-danger" onClick={onDelete}>
        <TrashIcon size={16} />
        <span>Delete</span>
      </button>
    </div>
  );
}
