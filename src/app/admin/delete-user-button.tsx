"use client";

import { useState } from "react";
import { deleteUserAsAdminAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={pending}
      className="text-[#a4492a]"
      onClick={async () => {
        if (!confirm(`Supprimer définitivement le compte de ${name} ? Toutes ses données (séances, mesures, messages…) seront effacées.`)) return;
        setPending(true);
        try {
          await deleteUserAsAdminAction(userId);
        } catch (err) {
          alert(err instanceof Error ? err.message : "La suppression a échoué.");
        } finally {
          setPending(false);
        }
      }}
    >
      Supprimer
    </Button>
  );
}
