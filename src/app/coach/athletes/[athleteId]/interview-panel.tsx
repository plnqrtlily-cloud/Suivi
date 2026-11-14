"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInterviewAction, resummarizeInterviewAction, applyInterviewAction, deleteInterviewAction } from "@/lib/interview-actions";
import type { InterviewSummary } from "@/lib/interview-ai";
import { Panel, PanelTitle, primaryBtn, ghostBtn, linkBtn, fieldClass } from "./tab-ui";

export interface InterviewView {
  id: string;
  createdAt: string;
  transcript: string;
  summary: InterviewSummary | null;
  appliedAt: string | null;
}

const SPORT_LABEL: Record<string, string> = {
  cycling: "Vélo / VTT",
  running: "Course à pied",
  hiking: "Randonnée",
  swimming: "Natation",
  climbing: "Escalade",
  strength: "Musculation",
  other: "Autre",
};
const GENDER_LABEL: Record<string, string> = { female: "Féminin", male: "Masculin", other: "Autre", prefer_not_to_say: "Non précisé" };
const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const frs = (iso: string) => `${Number(iso.slice(8, 10))} ${MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : la transcription
// se fait en direct, sans service payant ; rien n'est envoyé tant que le coach
// n'a pas validé le texte.
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
function makeRecognition(): Rec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

function Row({ children, checked, on, readOnly }: { children: React.ReactNode; checked: boolean; on: () => void; readOnly?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 py-1.5 text-sm text-ink ${readOnly ? "" : "cursor-pointer"}`}>
      {!readOnly && <input type="checkbox" checked={checked} onChange={on} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#1b4b4f]" />}
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
function H({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[12px] font-bold uppercase tracking-wider text-slate">{children}</p>;
}

function Summary({ s, picks, setPicks, readOnly }: { s: InterviewSummary; picks?: Picks; setPicks?: (p: Picks) => void; readOnly?: boolean }) {
  const toggle = (k: "mesures" | "charges" | "antecedents", i: number) =>
    picks && setPicks?.({ ...picks, [k]: picks[k].includes(i) ? picks[k].filter((x) => x !== i) : [...picks[k], i] });
  const p = s.profil;
  const portrait = [
    ["Contexte", p.contexte],
    ["Objectifs", p.objectifs],
    ["Contraintes", p.contraintes],
    ["Points forts", p.points_forts],
    ["Points faibles", p.points_faibles],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex flex-col">
      {s.resume && <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{s.resume}</p>}
      {portrait.length > 0 && (
        <>
          <H>Portrait</H>
          <Row readOnly={readOnly} checked={!!picks?.profil} on={() => picks && setPicks?.({ ...picks, profil: !picks.profil })}>
            <span className="flex flex-col gap-1">
              {portrait.map(([k, v]) => (
                <span key={k}>
                  <b className="font-semibold">{k} : </b>
                  {v}
                </span>
              ))}
              {!readOnly && <span className="text-xs text-slate">Ajouté à tes notes (onglet Notes), avec le résumé.</span>}
            </span>
          </Row>
        </>
      )}
      {(s.sports.length > 0 || s.genre) && <H>Profil</H>}
      {s.sports.length > 0 && (
        <Row readOnly={readOnly} checked={!!picks?.sports} on={() => picks && setPicks?.({ ...picks, sports: !picks.sports })}>
          <b className="font-semibold">Sports : </b>
          {s.sports.map((x) => SPORT_LABEL[x] ?? x).join(", ")}
          {s.sports_detail ? <span className="text-slate"> ({s.sports_detail})</span> : null}
        </Row>
      )}
      {s.genre && (
        <Row readOnly={readOnly} checked={!!picks?.genre} on={() => picks && setPicks?.({ ...picks, genre: !picks.genre })}>
          <b className="font-semibold">Genre : </b>
          {GENDER_LABEL[s.genre]}
        </Row>
      )}
      {s.mesures.length > 0 && <H>Statistiques de performance</H>}
      {s.mesures.map((m, i) => (
        <Row readOnly={readOnly} key={i} checked={!!picks?.mesures.includes(i)} on={() => toggle("mesures", i)}>
          <b className="font-semibold">{m.label ?? m.metric} : </b>
          {num(m.value)}
        </Row>
      ))}
      {s.charges.length > 0 && <H>Charges de référence</H>}
      {s.charges.map((c, i) => (
        <Row readOnly={readOnly} key={i} checked={!!picks?.charges.includes(i)} on={() => toggle("charges", i)}>
          <b className="font-semibold">{c.exercice} : </b>
          {c.kg != null ? `${num(c.kg)} kg${c.reps && c.reps > 1 ? ` × ${c.reps}` : ""}` : `${c.secondes} s`}
        </Row>
      ))}
      {s.antecedents.length > 0 && <H>Antécédents de blessure</H>}
      {s.antecedents.map((a, i) => (
        <Row readOnly={readOnly} key={i} checked={!!picks?.antecedents.includes(i)} on={() => toggle("antecedents", i)}>
          <b className="font-semibold">{a.zone}</b>
          {a.date_debut ? <span className="text-slate"> · {a.date_debut}</span> : null}
          {a.description ? <span> — {a.description}</span> : null}
          {a.a_surveiller ? <span className="block text-[13px] text-moss-dark">À surveiller : {a.a_surveiller}</span> : null}
        </Row>
      ))}
      {s.a_suivre.length > 0 && (
        <>
          <H>À creuser</H>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-ink-soft">
            {s.a_suivre.map((x, i) => (
              <li key={i}>• {x}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Picks = { profil: boolean; sports: boolean; genre: boolean; mesures: number[]; charges: number[]; antecedents: number[] };
const allPicks = (s: InterviewSummary): Picks => ({
  profil: true,
  sports: s.sports.length > 0,
  genre: !!s.genre,
  mesures: s.mesures.map((_, i) => i),
  charges: s.charges.map((_, i) => i),
  antecedents: s.antecedents.map((_, i) => i),
});

export function InterviewPanel({ athleteId, firstName, interviews, aiReady }: { athleteId: string; firstName: string; interviews: InterviewView[]; aiReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<"idle" | "consent" | "recording" | "review" | "result">("idle");
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; summary: InterviewSummary | null } | null>(null);
  const [picks, setPicks] = useState<Picks | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const recRef = useRef<Rec | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => () => {
    activeRef.current = false;
    recRef.current?.stop();
  }, []);

  function begin() {
    setError("");
    const rec = makeRecognition();
    if (!rec) {
      // Navigateur sans dictée (Firefox…) : saisie ou collage du texte.
      setSupported(false);
      setPhase("review");
      return;
    }
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      if (fin) setFinalText((t) => (t ? `${t} ${fin.trim()}` : fin.trim()));
      setInterim(tmp);
    };
    // La dictée s'arrête d'elle-même après un silence : on la relance tant
    // que l'entretien n'est pas terminé.
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {}
      }
    };
    rec.onerror = (e) => {
      // « no-speech » / « aborted » : simple silence, la relance s'en charge.
      if (e.error === "no-speech" || e.error === "aborted") return;
      activeRef.current = false;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Le micro n'est pas autorisé : autorise-le dans le navigateur, ou écris tes notes ci-dessous."
          : "La dictée s'est interrompue (connexion ?). Le texte déjà transcrit est gardé : tu peux reprendre ou compléter à la main."
      );
      setPhase("review");
    };
    recRef.current = rec;
    activeRef.current = true;
    setSeconds(0);
    setPhase("recording");
    rec.start();
  }

  function stop() {
    activeRef.current = false;
    recRef.current?.stop();
    setFinalText((t) => (interim ? `${t} ${interim}`.trim() : t));
    setInterim("");
    setPhase("review");
  }

  function summarize() {
    setError("");
    start(async () => {
      const res = await saveInterviewAction(athleteId, finalText);
      if (!res.id) {
        setError(res.error ?? "Impossible d'enregistrer.");
        return;
      }
      setResult({ id: res.id, summary: res.summary ?? null });
      if (res.summary) setPicks(allPicks(res.summary));
      if (res.error) setError(res.error);
      setFinalText("");
      setPhase("result");
      router.refresh();
    });
  }

  function apply(id: string, p: Picks) {
    start(async () => {
      try {
        await applyInterviewAction(id, p);
        setPhase("idle");
        setResult(null);
        setError("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "L'ajout au profil a échoué.");
      }
    });
  }

  return (
    <Panel className="flex scroll-mt-4 flex-col gap-3">
      <PanelTitle
        title="Entretien"
        hint={`Mène l'entretien avec ${firstName} : la conversation est transcrite, puis résumée, et tu reportes en un geste ce qui doit aller dans son profil.`}
      />

      {phase === "idle" && (
        <button type="button" className={`${primaryBtn} self-start`} onClick={() => setPhase("consent")}>
          Démarrer un entretien
        </button>
      )}

      {phase === "consent" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
          <p className="text-sm text-ink">
            Préviens {firstName} que l&apos;entretien est transcrit pour en garder un résumé. Seul le texte est conservé, pas l&apos;enregistrement audio.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} onClick={begin}>
              {firstName} est d&apos;accord, on commence
            </button>
            <button type="button" className={ghostBtn} onClick={() => setPhase("idle")}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e8896a] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#a4492a]" />
            </span>
            <b className="text-sm tabular-nums text-ink">Transcription en cours · {clock(seconds)}</b>
            <span className="flex-1" />
            <button type="button" className={primaryBtn} onClick={stop}>
              Terminer l&apos;entretien
            </button>
          </div>
          <div className="max-h-72 min-h-24 overflow-y-auto rounded-2xl bg-paper p-4 text-sm leading-relaxed text-ink">
            {finalText || interim ? (
              <>
                {finalText} <span className="text-slate">{interim}</span>
              </>
            ) : (
              <span className="text-slate">Parlez normalement, le texte apparaît ici…</span>
            )}
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate">
            {supported
              ? "Relis et corrige si besoin (noms, chiffres), puis lance le résumé."
              : "La dictée n'est pas disponible sur ce navigateur (essaie Chrome ou Safari). Tu peux écrire ou coller tes notes d'entretien ici."}
          </p>
          <textarea value={finalText} onChange={(e) => setFinalText(e.target.value)} rows={10} className={fieldClass} placeholder="Notes ou transcription de l'entretien…" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || finalText.trim().length < 20} className={primaryBtn} onClick={summarize}>
              {pending ? "Résumé en cours…" : "Enregistrer et résumer"}
            </button>
            {supported && (
              <button type="button" className={ghostBtn} onClick={begin}>
                Reprendre la dictée
              </button>
            )}
            <button
              type="button"
              className={linkBtn}
              onClick={() => {
                if (finalText && !window.confirm("Abandonner cet entretien ?")) return;
                setFinalText("");
                setPhase("idle");
              }}
            >
              Abandonner
            </button>
          </div>
          {!aiReady && <p className="text-xs text-slate">Le résumé automatique n&apos;est pas encore activé : la transcription sera enregistrée et pourra être résumée plus tard.</p>}
        </div>
      )}

      {phase === "result" && result && (
        <div className="flex flex-col gap-3">
          {result.summary && picks ? (
            <>
              <Summary s={result.summary} picks={picks} setPicks={setPicks} />
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" disabled={pending} className={primaryBtn} onClick={() => apply(result.id, picks)}>
                  {pending ? "Ajout…" : "Ajouter la sélection au profil"}
                </button>
                <button type="button" className={ghostBtn} onClick={() => setPhase("idle")}>
                  Plus tard
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate">Transcription enregistrée. Le résumé pourra être relancé depuis l&apos;historique ci-dessous.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-semibold text-[#a4492a]">{error}</p>}

      {interviews.length > 0 && (
        <ul className="mt-2 flex flex-col border-t border-line">
          {interviews.map((iv) => {
            const isOpen = open === iv.id;
            return (
              <li key={iv.id} className="border-b border-line py-3">
                <button type="button" onClick={() => setOpen(isOpen ? null : iv.id)} className="flex w-full items-baseline gap-3 text-left">
                  <b className="text-sm text-ink">Entretien du {frs(iv.createdAt)}</b>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate">{iv.summary?.resume ?? "Pas encore résumé"}</span>
                  <span className="flex-shrink-0 text-xs font-semibold text-moss-dark">{iv.appliedAt ? "Ajouté au profil" : isOpen ? "Fermer" : "Voir"}</span>
                </button>
                {isOpen && (
                  <div className="mt-3 flex flex-col gap-3">
                    {iv.summary ? (
                      <Summary s={iv.summary} readOnly />
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        className={`${primaryBtn} self-start`}
                        onClick={() =>
                          start(async () => {
                            const r = await resummarizeInterviewAction(iv.id);
                            if (r.error) setError(r.error);
                            else if (r.summary) {
                              setResult({ id: iv.id, summary: r.summary });
                              setPicks(allPicks(r.summary));
                              setPhase("result");
                            }
                            router.refresh();
                          })
                        }
                      >
                        {pending ? "Résumé en cours…" : "Résumer cet entretien"}
                      </button>
                    )}
                    {iv.summary && !iv.appliedAt && (
                      <button
                        type="button"
                        className={`${ghostBtn} self-start`}
                        onClick={() => {
                          setResult({ id: iv.id, summary: iv.summary });
                          setPicks(allPicks(iv.summary!));
                          setOpen(null);
                          setPhase("result");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Choisir quoi ajouter au profil
                      </button>
                    )}
                    <details className="text-sm text-slate">
                      <summary className="cursor-pointer">Transcription</summary>
                      <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{iv.transcript}</p>
                    </details>
                    <button
                      type="button"
                      className={`${linkBtn} self-start`}
                      onClick={() => {
                        if (!window.confirm("Supprimer cet entretien ?")) return;
                        start(async () => {
                          await deleteInterviewAction(iv.id);
                          router.refresh();
                        });
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
