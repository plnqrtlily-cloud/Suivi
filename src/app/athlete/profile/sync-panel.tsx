"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectProviderAction, disconnectProviderAction, addImportedActivityAction } from "@/lib/actions";
import { Button, Field, SelectField, sportLabel } from "@/components/ui";

// Type dupliqué volontairement depuis src/lib/queries.ts (et non importé) :
// ce fichier est un composant client, importer queries.ts entraînerait
// better-sqlite3 dans le bundle navigateur (même bug que celui corrigé sur le cycle).
export interface ExternalConnection {
  provider: "garmin" | "strava";
  status: "disconnected" | "connected" | "error";
  last_sync_at: string | null;
  last_error: string | null;
}

const PROVIDER_LABELS: Record<string, string> = { garmin: "Garmin Connect", strava: "Strava" };

const STATUS_STYLES: Record<string, string> = {
  connected: "bg-moss/10 text-moss-dark",
  disconnected: "bg-line text-slate",
  error: "bg-status-partial/15 text-status-partial",
};
const STATUS_LABELS: Record<string, string> = {
  connected: "Connecté",
  disconnected: "Non connecté",
  error: "Erreur de connexion",
};

function ConnectionRow({ connection }: { connection: ExternalConnection }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(connection.last_error || undefined);

  async function handleConnect() {
    setPending(true);
    const res = await connectProviderAction(connection.provider);
    if (res?.error) setLocalError(res.error);
    setPending(false);
    router.refresh();
  }

  async function handleDisconnect() {
    setPending(true);
    await disconnectProviderAction(connection.provider);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">{PROVIDER_LABELS[connection.provider]}</p>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[connection.status]}`}>
            {STATUS_LABELS[connection.status]}
          </span>
        </div>
        {connection.status === "connected" ? (
          <Button type="button" variant="ghost" onClick={handleDisconnect} disabled={pending}>
            Déconnecter
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={handleConnect} disabled={pending}>
            Connecter
          </Button>
        )}
      </div>
      {localError && <p className="mt-2 text-xs text-clay">{localError}</p>}
    </div>
  );
}

export function SyncPanel({ connections, activities }: { connections: ExternalConnection[]; activities: any[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [importSport, setImportSport] = useState("running");

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    await addImportedActivityAction(new FormData(form));
    setPending(false);
    // `e.currentTarget` est nettoyé par React après l'await (event synthétique) —
    // la référence capturée avant reste la seule façon fiable de reset() ici.
    form.reset();
    setImportSport("running");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {connections.map((c) => (
          <ConnectionRow key={c.provider} connection={c} />
        ))}
      </div>

      <div className="rounded-2xl border border-line p-4">
        <p className="mb-1 text-sm font-medium text-ink-soft">Import manuel</p>
        <p className="mb-3 text-xs text-slate">
          Filet de sécurité indépendant de Garmin et Strava — utile si la synchronisation automatique n&apos;est
          pas configurée ou momentanément indisponible.
        </p>
        <form onSubmit={handleImport} className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" name="activityDate" required />
          <Field label="Heure (facultatif)" type="time" name="activityTime" />
          <SelectField label="Sport" name="sport" value={importSport} onChange={(e) => setImportSport(e.target.value)}>
            <option value="running">Course à pied</option>
            <option value="cycling">Vélo</option>
            <option value="hiking">Randonnée</option>
            <option value="swimming">Natation</option>
            <option value="climbing">Escalade</option>
            <option value="strength">Musculation</option>
          </SelectField>
          <Field label="Durée (minutes)" type="number" name="durationMinutes" min={0} />
          {importSport !== "strength" && <Field label="Distance (km)" type="number" step="0.1" name="distanceKm" min={0} />}
          <Field label="FC moyenne (bpm)" type="number" name="avgHr" min={0} />
          {(importSport === "hiking" || importSport === "cycling" || importSport === "running") && (
            <Field label="Dénivelé positif (m)" type="number" name="elevationGainM" min={0} />
          )}
          {importSport === "cycling" && <Field label="Puissance moyenne (W)" type="number" name="avgPowerW" min={0} />}
          <Field label="RPE ressenti (facultatif)" type="number" name="rpe" min={1} max={10} placeholder="1 à 10" />
          <Field label="Notes" name="notes" />
          <div className="col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter l'activité"}
            </Button>
          </div>
        </form>
      </div>

      {activities.length > 0 && (
        <details className="text-sm text-slate">
          <summary className="cursor-pointer">Activités importées récentes</summary>
          <ul className="mt-2 space-y-1">
            {activities.map((a) => (
              <li key={a.id}>
                {a.activity_date}
                {a.activity_time ? ` ${a.activity_time}` : ""} — {sportLabel(a.sport)}
                {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                {a.distance_km ? ` · ${a.distance_km} km` : ""}
                {a.avg_hr ? ` · FC moy. ${a.avg_hr}` : ""}
                {a.source !== "manual" ? ` · via ${PROVIDER_LABELS[a.source]}` : " · saisie manuelle"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
