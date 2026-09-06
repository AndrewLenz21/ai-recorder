export type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "stopping"
  | "completed"
  | "error";

export type RecordingEvent =
  | {
      type: "recordingStarted";
      id: string;
      recordingId: string;
      timestampMs: number;
      absoluteTimestamp: string;
    }
  | {
      type: "recordingPaused";
      id: string;
      recordingId: string;
      timestampMs: number;
      absoluteTimestamp: string;
    }
  | {
      type: "recordingResumed";
      id: string;
      recordingId: string;
      timestampMs: number;
      absoluteTimestamp: string;
    }
  | {
      type: "recordingStopped";
      id: string;
      recordingId: string;
      timestampMs: number;
      absoluteTimestamp: string;
    }
  | {
      type: "screenCapture";
      id: string;
      recordingId: string;
      timestampMs: number;
      absoluteTimestamp: string;
      imagePath: string;
      fileName: string;
    };

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type RecordingSession = {
  id: string;
  title?: string | null;
  folderId?: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  audioFile: string | null;
  sampleRate: number;
  channels: number;
  directory: string;
  events: RecordingEvent[];
  transcript?: TranscriptSegment[] | null;
  summary?: string | null;
};

export type SessionSummary = {
  id: string;
  title?: string | null;
  folderId?: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  screenshotCount: number;
  fileSizeBytes: number;
  audioFile: string | null;
};

export type FolderIcon =
  | "folder"
  | "briefcase"
  | "microphone"
  | "lightbulb"
  | "book"
  | "code"
  | "people"
  | "video"
  | "graduation"
  | "star"
  | "archive";

export type FolderColor =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "red"
  | "pink"
  | "teal"
  | "gray";

export type RecordingFolder = {
  id: string;
  name: string;
  icon: FolderIcon;
  color: FolderColor;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibrarySnapshot = {
  folders: RecordingFolder[];
  defaultFolderId?: string | null;
};

export type StorageStats = {
  recordingCount: number;
  durationMs: number;
  audioBytes: number;
  screenshotBytes: number;
  usedBytes: number;
};

export type RecorderStateDto = {
  status: RecordingStatus;
  session: RecordingSession | null;
  durationMs: number;
  error: string | null;
};

export type PermissionState = "granted" | "denied" | "notDetermined" | "unknown";

export type PermissionsStatus = {
  microphone: PermissionState;
  screenRecording: PermissionState;
};

export type DetectedApp = {
  id: string;
  name: string;
  running: boolean;
  focused: boolean;
  reliability: "reliable" | "inferred" | "unavailable";
};

export type FocusedApp = {
  name: string;
  title: string | null;
  reliability: "reliable" | "inferred" | "unavailable";
};

export type InferredCall = {
  appId: string;
  reason: string;
  reliability: "inferred";
};

export type CapabilityNote = {
  level: "reliable" | "inferred" | "unavailable";
  text: string;
};

export type MeetingSnapshot = {
  runningApps: DetectedApp[];
  focusedApp: FocusedApp | null;
  inferredActiveCall: InferredCall | null;
  notes: CapabilityNote[];
};
