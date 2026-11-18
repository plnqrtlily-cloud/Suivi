"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Linkify } from "@/components/linkify";

// Détail d'un exercice de musculation, ouvert en touchant l'exercice dans la
// séance : démonstration, consignes, prescription série par série (charge
// convertie en kilos quand le max de l'athlète est connu), tempo expliqué et
// intention de la qualité travaillée. Tout ce qu'il faut pour l'exécuter sans
// avoir à demander au coach.

export interface ExerciseDetailData {
  name: string;
  blockTitle: string;
  /** Couleur de la partie de séance (échauffement, corps de séance…). */
  partColor?: string;
  qualityLabel: string | null;
  qualityTip: string | null;
  repType: "reps" | "time";
  tempo: { raw: string; phases: { label: string; value: string }[] | null } | null;
  coachNotes: string | null;
  /** Série (circuit) dont fait partie l'exercice. */
  series: { label: string; rounds: number; restSeconds: number | null; others: string[] } | null;
  sets: { n: number; reps: string | null; load: string | null; loadKg: string | null; rest: number | null; rpe: number | null; rir: number | null }[];
  maxKg: number | null;
  demo: { kind: "video" | "image"; url: string; mime?: string; title: string; caption: string | null; builtIn: boolean } | null;
}

function restLabel(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")}` : ""}` : `${s} s`;
}

// Animation de démonstration : fond de chargement pendant le téléchargement, et
// nouvel essai automatique si le chargement échoue (réseau mobile instable) —
// plus besoin de quitter la séance et d'y revenir pour la voir.
function DemoImage({ url, alt }: { url: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = attempt === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}r=${attempt}`;
  return (
    <div className="relative aspect-video w-full bg-white">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-[#1b4b4f]" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => attempt < 3 && setTimeout(() => setAttempt((a) => a + 1), 400 * (attempt + 1))}
        className={`h-full w-full object-contain transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/** Lance le téléchargement de la démonstration avant même l'ouverture de la fiche. */
function preload(url: string | undefined) {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.decoding = "async";
  img.src = url;
}

export function ExerciseDetailButton({ data, children }: { data: ExerciseDetailData; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const demoImage = data.demo?.kind === "image" ? data.demo.url : undefined;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Les contrôles d'une démonstration en ligne (vidéo) gardent leur rôle.
          if ((e.target as HTMLElement).closest("video, a")) return;
          setOpen(true);
        }}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(true))}
        onPointerEnter={() => preload(demoImage)}
        onPointerDown={() => preload(demoImage)}
        className="group -mx-1.5 cursor-pointer rounded-xl px-1.5 py-1 transition-colors hover:bg-paper-dim/60"
        aria-label={`Voir le détail de ${data.name}`}
      >
        {children}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-moss-dark group-hover:underline">
          Voir le détail <span aria-hidden>›</span>
        </span>
      </div>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-label={data.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] bg-white px-5 pt-4 shadow-2xl sm:max-w-lg sm:rounded-[26px]"
              style={{ paddingBottom: "max(26px, env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line sm:hidden" />
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: data.partColor ?? "#5b6660" }}>{data.blockTitle}</p>
                  <h2 className="text-[22px] font-bold leading-tight text-ink">{data.name}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-paper-dim text-slate hover:text-ink">
                  ×
                </button>
              </div>

              {data.demo && (
                <figure className="mb-4 overflow-hidden rounded-2xl border border-line bg-paper-dim">
                  {data.demo.kind === "video" ? (
                    <video controls playsInline className="aspect-video w-full bg-ink">
                      <source src={data.demo.url} type={data.demo.mime} />
                    </video>
                  ) : (
                    <DemoImage url={data.demo.url} alt={data.demo.title} />
                  )}
                  {(data.demo.caption || data.demo.builtIn) && (
                    <figcaption className="px-3 py-2 text-[13px] text-ink-soft">
                      {data.demo.caption}
                      {data.demo.builtIn && <span className="block text-[11.5px] text-slate">Démonstration indicative · {data.demo.title}</span>}
                    </figcaption>
                  )}
                </figure>
              )}

              {data.coachNotes && (
                <section className="mb-4 rounded-2xl bg-[#e3eeed] px-3.5 py-3">
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-moss-dark">Consigne du coach</p>
                  <p className="whitespace-pre-line text-[14.5px] text-ink"><Linkify text={data.coachNotes} /></p>
                </section>
              )}

              <section className="mb-4">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate">À faire</p>
                {data.series && (
                  <p className="mb-2 text-[13.5px] text-ink-soft">
                    {data.series.label} · {data.series.rounds} tour{data.series.rounds > 1 ? "s" : ""}
                    {data.series.restSeconds ? ` · ${restLabel(data.series.restSeconds)} de récup entre les tours` : ""}
                    {data.series.others.length > 0 && <span className="block text-[12.5px] text-slate">Enchaîné avec : {data.series.others.join(", ")}</span>}
                  </p>
                )}
                {data.sets.length > 0 ? (
                  <ol className="flex flex-col gap-1.5">
                    {data.sets.map((s) => (
                      <li key={s.n} className="flex flex-wrap items-baseline gap-x-2 rounded-xl border border-line px-3 py-2 text-[14px]">
                        <b className="text-slate">{data.sets.length > 1 ? `Série ${s.n}` : "Série"}</b>
                        {s.reps && <b className="text-ink">{data.repType === "time" ? `⏱ ${s.reps}` : `${s.reps} rép.`}</b>}
                        {s.load && (
                          <span className="text-ink">
                            {s.loadKg ? `${s.load.replace(/\s*%?$/, "")} %` : s.load}
                            {s.loadKg && <b className="text-moss-dark"> ≈ {s.loadKg}</b>}
                          </span>
                        )}
                        {s.rest ? <span className="text-slate">récup {restLabel(s.rest)}</span> : null}
                        {s.rpe ? <span className="text-slate">RPE {s.rpe}</span> : null}
                        {s.rir != null ? <span className="text-slate">RIR {s.rir}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13.5px] text-slate">Pas de prescription chiffrée : suis la consigne de ton coach.</p>
                )}
                {data.maxKg ? <p className="mt-1.5 text-[12px] text-slate">Kilos calculés depuis ton max : {data.maxKg} kg (arrondi à 2,5 kg).</p> : null}
                {(data.sets.some((s) => s.rpe) || data.sets.some((s) => s.rir != null)) && (
                  <p className="mt-1 text-[12px] text-slate">
                    {data.sets.some((s) => s.rpe) && "RPE = effort ressenti sur 10. "}
                    {data.sets.some((s) => s.rir != null) && "RIR = répétitions que tu aurais encore pu faire."}
                  </p>
                )}
              </section>

              {data.tempo && (
                <section className="mb-4">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate">Tempo {data.tempo.raw}</p>
                  {data.tempo.phases ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {data.tempo.phases.map((p) => (
                        <div key={p.label} className="rounded-xl bg-paper-dim px-2.5 py-2">
                          <p className="text-[15px] font-bold text-ink">{p.value}</p>
                          <p className="text-[11.5px] leading-tight text-slate">{p.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13.5px] text-ink-soft">Rythme d&apos;exécution indiqué par ton coach.</p>
                  )}
                </section>
              )}

              {data.qualityTip && (
                <section>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Objectif · {data.qualityLabel}</p>
                  <p className="text-[13.5px] text-ink-soft">{data.qualityTip}</p>
                </section>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
