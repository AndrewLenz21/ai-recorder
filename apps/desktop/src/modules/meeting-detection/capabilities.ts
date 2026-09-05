export const MEETING_DETECTION_CAPABILITIES = {
  reliable: [
    "Whether Microsoft Teams is running as a local process.",
    "Whether Teams, Zoom, Slack, or Discord is the foreground application, when window metadata is available.",
  ],
  inferred: [
    "Whether the user appears to be in a call, based only on window title keywords such as “meeting” or “call”.",
  ],
  unavailable: [
    "Confirmed in-meeting state for Microsoft Teams without a vendor API.",
    "Browser-based Google Meet call state.",
    "Who is speaking, participants, or meeting identity.",
  ],
} as const;
