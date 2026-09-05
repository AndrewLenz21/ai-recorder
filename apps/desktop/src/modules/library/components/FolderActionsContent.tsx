import { CheckIcon, PencilIcon, StarIcon } from "@/shared/components/icons";

type Props = {
  isDefault: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
};

export function FolderActionsContent({ isDefault, onEdit, onSetDefault }: Props) {
  return (
    <div className="folder-actions">
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
    </div>
  );
}
