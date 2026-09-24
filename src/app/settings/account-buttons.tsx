"use client";

import { useState } from "react";
import { logoutAllSessionsAction, deleteMyAccountAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function LogoutAllButton() {
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async () => {
        if (!confirm("Déconnecter tous les appareils sur lesquels vous êtes actuellement connecté·e ?")) return;
        setPending(true);
        await logoutAllSessionsAction();
        setPending(false);
      }}
    >
      <Button variant="secondary" type="submit" loading={pending}>
        Déconnecter tous les appareils
      </Button>
    </form>
  );
}

export function DeleteAccountButton() {
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async () => {
        const confirmation = prompt(
          "Cette action est définitive et supprime toutes vos données (séances, mesures, journal, blessures, cycle). Tapez SUPPRIMER pour confirmer."
        );
        if (confirmation !== "SUPPRIMER") return;
        setPending(true);
        await deleteMyAccountAction();
      }}
    >
      <Button variant="ghost" type="submit" className="text-clay" loading={pending}>
        Supprimer définitivement mon compte
      </Button>
    </form>
  );
}
