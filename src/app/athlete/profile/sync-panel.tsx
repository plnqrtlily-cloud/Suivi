"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectProviderAction, disconnectProviderAction } from "@/lib/actions";
import { Button, sportLabel } from "@/components/ui";
import { EditImportedActivityModal, DeleteImportedActivityButton } from "@/components/imported-activity-modal";

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

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {connections.map((c) => (
          <ConnectionRow key={c.provider} connection={c} />
        ))}
      </div>

      {activities.length > 0 && (
        <details className="text-sm text-slate">
          <summary className="cursor-pointer">Activités importées récentes</summary>
          <ul className="mt-2 space-y-1">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  {a.activity_date}
                  {a.activity_time ? ` ${a.activity_time}` : ""} — {sportLabel(a.sport)}
                  {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                  {a.distance_km ? ` · ${a.distance_km} km` : ""}
                  {a.avg_hr ? ` · FC moy. ${a.avg_hr}` : ""}
                  {a.source !== "manual" ? ` · via ${PROVIDER_LABELS[a.source]}` : " · saisie manuelle"}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2 text-slate">
                  <EditImportedActivityModal activity={a} className="hover:text-ink" />
                  <DeleteImportedActivityButton id={a.id} className="hover:text-clay" />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
