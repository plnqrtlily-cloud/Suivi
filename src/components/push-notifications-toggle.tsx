"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/lib/actions";
import { Button } from "@/components/ui";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "unsupported" | "loading" | "off" | "on" | "denied";

export function PushNotificationsToggle({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, [publicKey]);

  async function handleEnable() {
    if (!publicKey) return;
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await subscribePushAction({ endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } });
      setStatus("on");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setPending(false);
    }
  }

  if (status === "unsupported") {
    return <p className="text-sm text-slate">Les notifications push ne sont pas disponibles sur ce navigateur/appareil.</p>;
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-slate">
        Les notifications sont bloquées pour ce site dans votre navigateur — autorisez-les dans ses réglages pour les
        activer ici.
      </p>
    );
  }
  if (status === "loading") {
    return <p className="text-sm text-slate">Vérification…</p>;
  }

  return status === "on" ? (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-soft">Activées sur cet appareil.</p>
      <Button type="button" variant="ghost" onClick={handleDisable} disabled={pending}>
        Désactiver
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-soft">Recevez un rappel de séance ou un message même app fermée.</p>
      <Button type="button" variant="secondary" onClick={handleEnable} disabled={pending}>
        {pending ? "Activation…" : "Activer"}
      </Button>
    </div>
  );
}
