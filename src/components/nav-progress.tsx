"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// Barre fine en haut de l'écran dès qu'on touche un lien interne : on voit
// tout de suite que le clic est pris en compte, même si la page met un
// instant à arriver. Elle se termine quand la nouvelle page est affichée.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;
  const keyRef = useRef(key);
  // Page affichée au moment du clic : tant qu'on y est encore, la barre avance ;
  // dès que la page change, elle se termine puis disparaît.
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | null = null;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setFrom(keyRef.current);
      if (safety) clearTimeout(safety);
      safety = setTimeout(() => setFrom(null), 15_000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (safety) clearTimeout(safety);
    };
  }, []);

  if (from === null) return null;
  const done = from !== key;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden>
      <div
        onTransitionEnd={() => done && setFrom(null)}
        className="h-full bg-[#e8896a] shadow-[0_0_8px_#e8896a]"
        style={{
          width: done ? "100%" : "80%",
          opacity: done ? 0 : 1,
          transition: done ? "width 150ms ease-out, opacity 200ms ease-out 120ms" : undefined,
          animation: done ? undefined : "navprogress-in 8s cubic-bezier(0.1, 0.7, 0.2, 1)",
        }}
      />
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
