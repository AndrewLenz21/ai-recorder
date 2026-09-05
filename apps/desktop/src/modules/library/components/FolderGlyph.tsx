import type { FolderIcon } from "@/tauri/types";

type Props = {
  icon: FolderIcon | "all";
  size?: number;
};

export function FolderGlyph({ icon, size = 18 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true as const,
  };

  switch (icon) {
    case "all":
      return (
        <svg {...common}>
          <path d="M5 7h14M5 12h14M5 17h10" strokeLinecap="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3.5" y="8" width="17" height="11.5" rx="2" />
          <path d="M9 8V6.8A1.8 1.8 0 0 1 10.8 5h2.4A1.8 1.8 0 0 1 15 6.8V8M3.5 13h17" strokeLinecap="round" />
        </svg>
      );
    case "microphone":
      return (
        <svg {...common}>
          <rect x="9" y="4" width="6" height="10" rx="3" />
          <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3" strokeLinecap="round" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg {...common}>
          <path d="M8.2 10a3.8 3.8 0 1 1 7.6 0c0 1.7-1 2.6-1.7 3.4-.5.5-.8 1.2-.8 1.9h-2.6c0-.7-.3-1.4-.8-1.9-.7-.8-1.7-1.7-1.7-3.4Z" />
          <path d="M10 19h4" strokeLinecap="round" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M6 5.5h10.2A2.3 2.3 0 0 1 18.5 7.8v10.2H8.2A2.2 2.2 0 0 0 6 20.2V5.5Z" />
          <path d="M6 5.5A2.2 2.2 0 0 1 8.2 3.3H18" strokeLinecap="round" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="2.3" />
          <circle cx="15.5" cy="9.2" r="1.9" />
          <path d="M4.5 18c.4-2.8 2.4-4.3 4.6-4.3s4.1 1.5 4.5 4.3" />
          <path d="M13.2 13.9c1.5-.4 3.2.4 3.8 2.6" strokeLinecap="round" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3.5" y="7" width="12.5" height="10" rx="2" />
          <path d="m16 10.5 4.2-2.2v7.4L16 13.5" strokeLinejoin="round" />
        </svg>
      );
    case "graduation":
      return (
        <svg {...common}>
          <path d="m3.5 10 8.5-4.5L20.5 10 12 14.5 3.5 10Z" strokeLinejoin="round" />
          <path d="M7 12.2v4.1c0 .6 2.2 2.2 5 2.2s5-1.6 5-2.2v-4.1" strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 4.5 2.1 4.4 4.8.7-3.5 3.4.8 4.8L12 15.6 7.8 17.8l.8-4.8-3.5-3.4 4.8-.7L12 4.5Z" strokeLinejoin="round" />
        </svg>
      );
    case "archive":
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="4.2" rx="1.2" />
          <path d="M5 8.7h14v9.8a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.5V8.7ZM10 13h4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 7.5A2 2 0 0 1 6 5.5h4.2l1.6 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z" strokeLinejoin="round" />
        </svg>
      );
  }
}
