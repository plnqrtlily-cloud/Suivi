"use client";

import { useEffect, useRef, useState } from "react";

// Menu « ⋯ » : regroupe les actions secondaires d'une séance (modifier,
// copier, dupliquer, déplacer, supprimer…) au lieu d'une longue rangée de
// boutons. Le contenu reste monté quand le menu est fermé (simplement masqué) :
// une fenêtre ouverte depuis une action (ex. « Envoyer à… ») ne disparaît pas.
export const menuItem =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-[#eef3f2] disabled:opacity-50";

export function MoreMenu({ children, label = "Plus d'actions" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          open ? "border-[#1b4b4f] bg-[#1b4b4f] text-white" : "border-line bg-white text-ink hover:border-[#1b4b4f]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <circle cx="4" cy="10" r="1.8" />
          <circle cx="10" cy="10" r="1.8" />
          <circle cx="16" cy="10" r="1.8" />
        </svg>
      </button>
      <div
        role="menu"
        className={`${open ? "" : "hidden"} absolute right-0 top-full z-[60] mt-2 flex min-w-[230px] flex-col rounded-2xl border border-line bg-white p-1.5 shadow-xl`}
        onClick={(e) => {
          // Une action choisie referme le menu.
          if ((e.target as HTMLElement).closest("button, a")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
