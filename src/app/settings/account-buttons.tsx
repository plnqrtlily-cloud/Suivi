"use client";

import { logoutAllSessionsAction, deleteMyAccountAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function LogoutAllButton() {
  return (
    <form
      action={async () => {
        if (!confirm("Déconnecter tous les appareils sur lesquels vous êtes actuellement connecté·e ?")) return;
        await logoutAllSessionsAction();
      }}
    >
      <Button variant="secondary" type="submit">
        Déconnecter tous les appareils
      </Button>
    </form>
  );
}

export function DeleteAccountButton() {
  return (
    <form
      action={async () => {
        const confirmation = prompt(
          "Cette action est définitive et supprime toutes vos données (séances, mesures, journal, blessures, cycle). Tapez SUPPRIMER pour confirmer."
        );
        if (confirmation !== "SUPPRIMER") return;
        await deleteMyAccountAction();
      }}
    >
      <Button variant="ghost" type="submit" className="text-clay">
        Supprimer définitivement mon compte
      </Button>
    </form>
  );
}
