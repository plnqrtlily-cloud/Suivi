"use client";

import { useEffect, useLayoutEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

// Défilement continu d'une page de calendrier (semaines ou mois empilés) :
// - à l'ouverture, on se place sur la page demandée (anchorId) ;
// - en approchant du haut ou du bas, la plage s'étend (prevHref / nextHref,
//   rendus côté serveur) sans que l'affichage saute ;
// - en fin de geste, si le début d'une page ([data-page]) est proche du haut
//   de l'écran, on s'y cale en douceur.
// Safari ne compense pas tout seul un ajout de contenu au-dessus de l'écran
// (pas d'« ancrage de défilement ») : la compensation est faite ici, et
// l'ancrage du navigateur est coupé pour ne pas la doubler ailleurs.
const MARGIN = 8; // marge au-dessus d'une page calée
// Haut utile de l'écran : sous l'en-tête fixe de la page s'il y en a un.
const top = () => (document.querySelector("[data-sticky-head]")?.getBoundingClientRect().height ?? 0) + MARGIN;
const NEAR = 160; // distance en dessous de laquelle on se cale

export function ContinuousScroll({
  anchorId,
  prevHref,
  nextHref,
  rangeKey,
  navKey,
  children,
}: {
  anchorId: string;
  prevHref: string;
  nextHref: string;
  rangeKey: string;
  // Change quand on choisit un jour : l'élément touché reste à sa place même
  // si du contenu bouge au-dessus (détail du jour déplacé d'un mois à l'autre).
  navKey?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<{ id: string; top: number } | null>(null);
  const progRef = useRef(0);
  const readyRef = useRef(false);
  const busyRef = useRef(false);

  // Ouverture : la page demandée en haut de l'écran.
  useLayoutEffect(() => {
    document.documentElement.style.overflowAnchor = "none";
    const el = document.getElementById(anchorId);
    if (el) {
      progRef.current = Date.now() + 300;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - top() });
    }
    readyRef.current = true;
    return () => {
      document.documentElement.style.overflowAnchor = "";
    };
    // Une seule fois : les extensions de plage ne doivent pas ramener en arrière.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Après une extension vers le haut (ou le choix d'un jour) : l'élément qui
  // était à l'écran reste au même endroit.
  useLayoutEffect(() => {
    busyRef.current = false;
    const keep = keepRef.current;
    keepRef.current = null;
    if (!keep) return;
    const el = document.getElementById(keep.id);
    if (!el) return;
    progRef.current = Date.now() + 300;
    window.scrollBy(0, el.getBoundingClientRect().top - keep.top);
  }, [rangeKey, navKey]);

  // Approche d'un bord : on étend la plage.
  useEffect(() => {
    const extend = (dir: -1 | 1) => {
      if (busyRef.current || !readyRef.current) return;
      busyRef.current = true;
      if (dir < 0) {
        // Repère : la première page visible.
        const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-page]"));
        const first = pages.find((p) => p.getBoundingClientRect().bottom > top());
        if (first?.id) keepRef.current = { id: first.id, top: first.getBoundingClientRect().top };
      }
      startTransition(() => router.replace(dir < 0 ? prevHref : nextHref, { scroll: false }));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) extend(e.target === topRef.current ? -1 : 1);
      },
      { rootMargin: "900px 0px" }
    );
    if (topRef.current) io.observe(topRef.current);
    if (bottomRef.current) io.observe(bottomRef.current);
    return () => io.disconnect();
  }, [prevHref, nextHref, router]);

  // Fin de geste : calage doux sur le début de page le plus proche.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (Date.now() < progRef.current) {
        t = setTimeout(settle, progRef.current - Date.now() + 60);
        return;
      }
      let best: number | null = null;
      const t0 = top();
      for (const p of document.querySelectorAll<HTMLElement>("[data-page]")) {
        const d = p.getBoundingClientRect().top - t0;
        if (best === null || Math.abs(d) < Math.abs(best)) best = d;
      }
      if (best !== null && Math.abs(best) > 2 && Math.abs(best) < NEAR) {
        progRef.current = Date.now() + 700;
        window.scrollBy({ top: best, behavior: "smooth" });
      }
    };
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(settle, 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      <div ref={topRef} className="flex h-6 items-center justify-center text-xs font-semibold text-slate">
        {pending ? "Chargement…" : null}
      </div>
      <div
        onClickCapture={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-keep]");
          if (el?.id) keepRef.current = { id: el.id, top: el.getBoundingClientRect().top };
        }}
      >
        {children}
      </div>
      <div ref={bottomRef} className="flex h-10 items-center justify-center text-xs font-semibold text-slate">
        {pending ? "Chargement…" : null}
      </div>
    </>
  );
}
