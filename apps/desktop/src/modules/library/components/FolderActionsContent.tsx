import { CheckIcon, PencilIcon, PlusIcon, StarIcon, TrashIcon } from "@/shared/components/icons";

type Props = {
  isDefault: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onNewSubfolder?: () => void;
  onDelete?: () => void;
};

export function FolderActionsContent({
  isDefault,
  onEdit,
  onSetDefault,
  onNewSubfolder,
  onDelete,
}: Props) {
  return (
    <div className="folder-actions">
      {onNewSubfolder ? (
        <button type="button" role="menuitem" className="folder-action" onClick={onNewSubfolder}>
          <PlusIcon size={16} />
          <span>New subfolder</span>
        </button>
      ) : null}
      <button type="button" role="menuitem" className="folder-action" onClick={onEdit}>
        <PencilIcon size={16} />
        <span>Edit folder</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="folder-action"
        disabled={isDefault}
        onClick={isDefault ? undefined : onSetDefault}
      >
        <StarIcon size={16} />
        <span>{isDefault ? "Default folder" : "Set as default"}</span>
        {isDefault ? <CheckIcon size={16} /> : null}
      </button>
      {onDelete ? (
        <button type="button" role="menuitem" className="folder-action is-danger" onClick={onDelete}>
          <TrashIcon size={16} />
          <span>Delete</span>
        </button>
      ) : null}
    </div>
  );
}
