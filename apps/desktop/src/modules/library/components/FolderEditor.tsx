import { useId, useState } from "react";

import { Button } from "@/shared/components/Button";
import type { FolderColor, FolderIcon, RecordingFolder } from "@/tauri/types";

import { FOLDER_COLORS, FOLDER_ICONS } from "../constants";
import { FolderGlyph } from "./FolderGlyph";

type Props = {
  folder?: RecordingFolder;
  variant?: "inline" | "dialog";
  onSave: (name: string, icon: FolderIcon, color: FolderColor, setAsDefault: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

export function FolderEditor({ folder, variant = "inline", onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(folder?.name ?? "");
  const [icon, setIcon] = useState<FolderIcon>(folder?.icon ?? "folder");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "blue");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const defaultFolderId = useId();
  const defaultFolderHelpId = useId();

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(name, icon, color, setAsDefault);
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

      <div className={`folder-editor-actions ${!folder && variant === "dialog" ? "is-create" : ""}`}>
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
        {!folder && variant === "dialog" ? (
          <div className="flex translate-y-[2px] items-center gap-2 text-[13px] text-foreground">
            <label className="flex cursor-pointer items-center gap-2" htmlFor={defaultFolderId}>
              <input
                id={defaultFolderId}
                type="checkbox"
                checked={setAsDefault}
                className="size-4 accent-control"
                onChange={(event) => setSetAsDefault(event.target.checked)}
              />
              <span className="font-medium">Set as default</span>
            </label>
            <span className="group relative inline-flex">
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                aria-label="About the default folder"
                aria-describedby={defaultFolderHelpId}
              >
                ?
              </button>
              <span
                id={defaultFolderHelpId}
                role="tooltip"
                className="pointer-events-none absolute left-0 bottom-[calc(100%+8px)] z-10 w-52 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs leading-[1.35] text-muted-foreground opacity-0 shadow-app transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                New recordings will use this folder by default.
              </span>
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={busy || name.trim().length === 0}>
            {folder ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </form>
  );
}
