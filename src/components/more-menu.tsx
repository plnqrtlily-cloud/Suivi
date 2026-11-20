"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
import { createPortal } from "react-dom";

// Menu « ⋯ » : regroupe les actions secondaires d'une séance (modifier,
// copier, dupliquer, déplacer, supprimer…) au lieu d'une longue rangée de
// boutons. Le contenu reste monté quand le menu est fermé (simplement masqué) :
// une fenêtre ouverte depuis une action (ex. « Envoyer à… ») ne disparaît pas.
export const menuItem =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-ink hover:bg-[#eef3f2] disabled:opacity-50";

export function MoreMenu({ children, label = "Plus d'actions", small = false }: { children: React.ReactNode; label?: string; /** Petit bouton, pour une ligne de liste. */ small?: boolean }) {
  const [open, setOpen] = useState(false);
  // Côté client seulement (le portail vise document.body).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Le menu s'affiche par-dessus tout (portail, position fixe) : il n'est
  // jamais rogné par un panneau ou une fenêtre, et s'ouvre vers le haut quand
  // la place manque en bas de l'écran.
  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = menu.current?.offsetHeight || 280;
    const right = Math.max(8, window.innerWidth - r.right);
    const below = window.innerHeight - r.bottom;
    setPos(below < h + 16 && r.top > below ? { right, bottom: window.innerHeight - r.top + 8 } : { right, top: r.bottom + 8 });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const list = (
    <div
      ref={menu}
      role="menu"
      style={pos}
      className={`${open ? "" : "hidden"} fixed z-[80] flex max-h-[80vh] min-w-[230px] flex-col overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl`}
      // Une action choisie referme le menu (en capture : certaines actions
      // arrêtent la propagation du clic pour ouvrir leur fenêtre).
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("button, a")) setOpen(false);
      }}
    >
      {children}
    </div>
  );

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex ${small ? "h-7 w-7" : "h-9 w-9"} items-center justify-center rounded-full border transition-colors ${
          open ? "border-[#1b4b4f] bg-[#1b4b4f] text-white" : "border-line bg-white text-ink hover:border-[#1b4b4f]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <circle cx="4" cy="10" r="1.8" />
          <circle cx="10" cy="10" r="1.8" />
          <circle cx="16" cy="10" r="1.8" />
        </svg>
      </button>
      {mounted ? createPortal(list, document.body) : null}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
