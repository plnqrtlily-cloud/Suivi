export type NavIconName = "home" | "calendar" | "library" | "profile" | "messages" | "settings" | "logout" | "dashboard" | "add" | "pitch" | "tag" | "shield";

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const common = {
    viewBox: "0 0 20 20",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 9.5l7-6 7 6" />
          <path d="M5 8v8a1 1 0 001 1h8a1 1 0 001-1V8" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8.5h14" />
          <path d="M6.5 2.5v3M13.5 2.5v3" />
        </svg>
      );
    case "library":
      return (
        <svg {...common}>
          <path d="M3 4.5c1.5-1 3.5-1 5 0v11c-1.5-1-3.5-1-5 0z" />
          <path d="M17 4.5c-1.5-1-3.5-1-5 0v11c1.5-1 3.5-1 5 0z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="10" cy="7" r="3" />
          <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M3 6h8M15 6h2" />
          <circle cx="12" cy="6" r="2" />
          <path d="M3 10h2M9 10h8" />
          <circle cx="6" cy="10" r="2" />
          <path d="M3 14h5M13 14h4" />
          <circle cx="10" cy="14" r="2" />
        </svg>
      );
    case "add":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6.5v7M6.5 10h7" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="7" rx="1.5" />
          <rect x="11" y="3" width="6" height="4" rx="1.5" />
          <rect x="3" y="12" width="6" height="5" rx="1.5" />
          <rect x="11" y="9" width="6" height="8" rx="1.5" />
        </svg>
      );
    case "pitch":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="14" height="12" rx="1.5" />
          <path d="M10 4v12" />
          <circle cx="10" cy="10" r="2.5" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M8 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
          <path d="M13 14l4-4-4-4" />
          <path d="M17 10H7" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M10.5 3H4a1 1 0 0 0-1 1v6.5a1 1 0 0 0 .3.7l7.5 7.5a1 1 0 0 0 1.4 0l6.5-6.5a1 1 0 0 0 0-1.4L11.2 3.3a1 1 0 0 0-.7-.3z" />
          <circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M10 2.5l6 2.2v5c0 4-2.5 6.8-6 7.8-3.5-1-6-3.8-6-7.8v-5z" />
          <path d="M7.3 10l1.9 1.9 3.5-3.9" />
        </svg>
      );
  }
}
