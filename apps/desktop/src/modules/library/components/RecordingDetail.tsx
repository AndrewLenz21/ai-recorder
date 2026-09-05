import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";

import { AudioPlayer, loadAudio, seekAudio, toggleAudio, unloadAudio } from "@/modules/audio-player";
import { useRecorder } from "@/modules/recorder";
import { useRecorderStore } from "@/modules/recorder/stores/recorder.store";
import { formatDateTime, formatTimestamp } from "@/shared/lib/time";
import type { RecordingSession, SessionSummary } from "@/tauri/types";

import { libraryService } from "../services/library.service";
import { useLibrary, useLibraryHydration } from "../hooks/useLibrary";
import { recordingTitle } from "../utils/recordings";
import { RecordingSidebar } from "./RecordingSidebar";

function toSummary(session: RecordingSession): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    folderId: session.folderId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    screenshotCount: session.events.filter((event) => event.type === "screenCapture").length,
    fileSizeBytes: 0,
    audioFile: session.audioFile,
  };
}

function CompactQuery() {
  return window.matchMedia("(max-width: 720px)");
}

export function RecordingDetail() {
  useLibraryHydration();
  const liveSession = useRecorderStore((state) => state.session);
  const viewingSession = useRecorderStore((state) => state.viewingSession);
  const session = viewingSession ?? liveSession;
  const { dismiss, openSession } = useRecorder();
  const { visibleRecordings, currentFolder, route, refresh } = useLibrary();
  const [collapsed, setCollapsed] = useState(() => CompactQuery().matches);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    const media = CompactQuery();
    const onChange = () => {
      if (media.matches) {
        setCollapsed(true);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!session?.audioFile) {
      unloadAudio();
      return;
    }
    loadAudio(convertFileSrc(session.audioFile), session.durationMs / 1000);
  }, [session?.id, session?.audioFile, session?.durationMs]);

  useEffect(() => {
    return () => unloadAudio();
  }, []);

  useEffect(() => {
    setTitleDraft(session ? recordingTitle(session) : "");
  }, [session]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      toggleAudio();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const captures = session?.events.filter((event) => event.type === "screenCapture") ?? [];

  const sidebarItems = useMemo(() => {
    if (!session) {
      return visibleRecordings;
    }
    if (visibleRecordings.some((item) => item.id === session.id)) {
      return visibleRecordings;
    }
    return [toSummary(session), ...visibleRecordings];
  }, [session, visibleRecordings]);

  if (!session) {
    return null;
  }

  const backLabel =
    route.name === "folder" && currentFolder
      ? `← ${currentFolder.name}`
      : route.name === "all"
        ? "← All Recordings"
        : "← Library";

  const saveTitle = async () => {
    const next = titleDraft.trim();
    const current = recordingTitle(session);
    if (next === current) {
      return;
    }
    const updated = await libraryService.renameSession(session.id, next);
    useRecorderStore.getState().setViewingSession(updated);
    await refresh();
  };

  return (
    <section className={`detail-shell ${collapsed ? "is-collapsed" : ""}`}>
      <RecordingSidebar
        items={sidebarItems}
        selectedId={session.id}
        backLabel={backLabel}
        collapsed={collapsed}
        onBack={() => void dismiss()}
        onSelect={(id) => {
          if (id !== session.id) {
            void openSession(id);
          }
        }}
        onToggle={() => setCollapsed(true)}
      />

      <div className="detail-main">
        <div className="detail-top">
          {collapsed ? (
            <button type="button" className="ghost-link" onClick={() => setCollapsed(false)}>
              Show recordings
            </button>
          ) : <span />}
          <button type="button" className="ghost-link" onClick={() => void dismiss()}>
            Close
          </button>
        </div>

        <header className="detail-header">
          <input
            className="detail-title"
            value={titleDraft}
            aria-label="Recording name"
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          <p className="detail-meta">
            {formatDateTime(session.startedAt)} · {formatTimestamp(session.durationMs)}
            {captures.length > 0
              ? ` · ${captures.length} screenshot${captures.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </header>

        {session.audioFile ? <AudioPlayer /> : <p className="muted">No audio in this recording.</p>}

        {captures.length > 0 ? (
          <ul className="capture-strip">
            {captures.map((event) =>
              event.type === "screenCapture" ? (
                <li key={event.id}>
                  <button
                    type="button"
                    className="capture-chip"
                    onClick={() => seekAudio(event.timestampMs / 1000)}
                  >
                    <img src={convertFileSrc(event.imagePath)} alt="" />
                    <span>{formatTimestamp(event.timestampMs)}</span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
