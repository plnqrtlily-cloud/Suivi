import type { StatusIconName } from "@/lib/session-status";

// Icônes de statut des séances (cf. src/lib/session-status.ts).
const PATHS: Record<StatusIconName, React.ReactNode> = {
  arrow: <path d="M4 10h11M11 5.5l4.5 4.5L11 14.5" />,
  hourglass: <path d="M6 3.5h8M6 16.5h8M7 3.5c0 3.5 6 3.5 6 6.5s-6 3-6 6.5M13 3.5c0 3.5-6 3.5-6 6.5s6 3 6 6.5" />,
  check: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
  cross: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
  question: <path d="M7.5 7.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M10 15h.01" />,
  postpone: <path d="M4 7h8a4 4 0 010 8H8M7 4L4 7l3 3" />,
  plus: <path d="M10 5v10M5 10h10" />,
};

export function StatusIcon({ name, size = 14, className, strokeWidth = 2.2 }: { name: StatusIconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
