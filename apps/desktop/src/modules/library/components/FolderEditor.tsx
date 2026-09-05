import { useState } from "react";

import { Button } from "@/shared/components/Button";
import type { FolderColor, FolderIcon, RecordingFolder } from "@/tauri/types";

import { FOLDER_COLORS, FOLDER_ICONS } from "../constants";
import { FolderGlyph } from "./FolderGlyph";

type Props = {
  folder?: RecordingFolder;
  variant?: "inline" | "dialog";
  onSave: (name: string, icon: FolderIcon, color: FolderColor) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

export function FolderEditor({ folder, variant = "inline", onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(folder?.name ?? "");
  const [icon, setIcon] = useState<FolderIcon>(folder?.icon ?? "folder");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "blue");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(name, icon, color);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={`folder-editor ${variant === "dialog" ? "is-dialog" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length === 0 || busy) {
          return;
        }
        void submit();
      }}
    >
      <div className="folder-editor-head">
        <span className={`folder-mark is-${color}`}>
          <FolderGlyph icon={icon} />
        </span>
        <input
          className="folder-name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Folder name"
          maxLength={48}
          aria-label="Folder name"
        />
      </div>

      <div className="folder-field">
        {variant === "dialog" ? <p className="folder-field-label">Icon</p> : null}
        <div className="folder-picker" role="listbox" aria-label="Folder icon">
          {FOLDER_ICONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === icon}
              aria-label={item.label}
              className={`folder-icon-option ${item.id === icon ? "is-active" : ""}`}
              onClick={() => setIcon(item.id)}
            >
              <FolderGlyph icon={item.id} size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="folder-field">
        {variant === "dialog" ? <p className="folder-field-label">Color</p> : null}
        <div className="folder-picker" role="listbox" aria-label="Folder color">
          {FOLDER_COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === color}
              aria-label={item.label}
              className={`folder-color-option is-${item.id} ${item.id === color ? "is-active" : ""}`}
              onClick={() => setColor(item.id)}
            />
          ))}
        </div>
      </div>

      <div className="folder-editor-actions">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="folder-delete"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || name.trim().length === 0}>
          {folder ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
