"use client";

/** Bouton (dans un menu) qui ouvre un bloc <details> de la page et y descend. */
export function OpenDetailsButton({ target, className, children }: { target: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const el = document.getElementById(target);
        if (el instanceof HTMLDetailsElement) el.open = true;
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </button>
  );
}
