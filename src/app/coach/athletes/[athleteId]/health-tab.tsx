"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInjuryForAthleteAction, closeInjuryForAthleteAction } from "@/lib/actions";
import type { CycleSummary } from "@/lib/athlete-overview";
import { Panel, PanelTitle, Row, TabHeader, Reveal, ghostBtn, primaryBtn, fieldClass, fieldLabel } from "./tab-ui";

export interface InjuryView {
  id: string;
  zone: string;
  description: string | null;
  dateLabel: string;
  active: boolean;
  duration: string | null;
}

export function HealthTab({
  athleteId,
  firstName,
  injuries,
  cycle,
  cycleShared,
  today,
}: {
  athleteId: string;
  firstName: string;
  injuries: InjuryView[];
  cycle: CycleSummary | null;
  cycleShared: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const active = injuries.filter((i) => i.active);
  const past = injuries.filter((i) => !i.active);

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Santé" subtitle={cycleShared ? "Blessures et cycle" : "Blessures"} />
      <div className={`grid gap-6 ${cycleShared ? "lg:grid-cols-2" : ""}`}>
        <Panel>
          <PanelTitle
            title="Blessures"
            right={
              <button type="button" className={ghostBtn} onClick={() => setAdding((v) => !v)}>
                {adding ? "Fermer" : "+ Déclarer une blessure"}
              </button>
            }
          />
          <Reveal open={adding}>
            <form
              className="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-paper p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                fd.set("athleteId", athleteId);
                start(async () => {
                  await addInjuryForAthleteAction(fd);
                  form.reset();
                  setAdding(false);
                  router.refresh();
                });
              }}
            >
              <div className="col-span-2">
                <label className={fieldLabel}>Zone</label>
                <input name="zone" required placeholder="ex. Genou gauche" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Description</label>
                <textarea name="description" rows={2} placeholder="Nature, contexte, adaptations prévues…" className={fieldClass} />
              </div>
              <div>
                <label className={fieldLabel}>Depuis le</label>
                <input type="date" name="dateStart" required defaultValue={today} className={fieldClass} />
              </div>
              <div>
                <label className={fieldLabel}>Guérie le (facultatif)</label>
                <input type="date" name="dateEnd" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={pending} className={primaryBtn}>
                  Enregistrer
                </button>
              </div>
            </form>
          </Reveal>

          {active.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 text-sm text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-moss" />
              Aucune blessure en cours
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((i) => (
                <li key={i.id} className="flex items-start gap-3 rounded-2xl bg-[#f7ebe6] px-4 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#a4492a]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {i.zone} <span className="font-normal text-ink-soft">· {i.dateLabel}</span>
                    </p>
                    {i.description && <p className="text-[13px] text-ink-soft">{i.description}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("injuryId", i.id);
                      start(async () => {
                        await closeInjuryForAthleteAction(fd);
                        router.refresh();
                      });
                    }}
                    className="shrink-0 text-[13px] font-semibold text-moss-dark hover:underline"
                  >
                    Marquer guérie
                  </button>
                </li>
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <p className="mb-1 mt-5 text-[15px] font-semibold text-ink">Antécédents</p>
              <ul className="flex flex-col">
                {past.map((i) => (
                  <li key={i.id} className="flex gap-3 border-t border-line py-3">
                    <span className="w-[3px] shrink-0 rounded-full bg-[#c9a48f]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[15px] font-semibold text-ink">{i.zone}</p>
                        <p className="text-[13px] text-slate">{i.dateLabel}</p>
                      </div>
                      {i.duration && <p className="text-[13px] text-ink-soft">{i.duration}</p>}
                      {i.description && <p className="text-[13px] text-slate">{i.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        {cycleShared && (
          <Panel>
            <PanelTitle title="Cycle menstruel" hint={`partagé par ${firstName}`} />
            {cycle ? (
              <>
                {cycle.current && <p className="mb-2 text-sm font-semibold text-[#5d4f86]">{cycle.current}</p>}
                <div className="flex flex-col">
                  {cycle.rows.map((r) => (
                    <Row key={r.label} label={r.label} value={r.value} />
                  ))}
                </div>
                {cycle.insight && <p className="mt-4 rounded-2xl bg-[#f4eff4] px-4 py-3 text-sm text-ink">{cycle.insight}</p>}
              </>
            ) : (
              <p className="text-sm text-slate">Pas encore de début de règles renseigné.</p>
            )}
            <p className="mt-4 text-xs text-slate">
              {firstName} peut arrêter le partage à tout moment. Seules les dates sont partagées, pas ses notes.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
