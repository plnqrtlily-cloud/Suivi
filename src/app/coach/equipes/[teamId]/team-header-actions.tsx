"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renameTeamAction, deleteTeamAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function TeamHeaderActions({ teamId, currentName }: { teamId: string; currentName: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(currentName);
  const [pending, setPending] = useState(false);

  if (renaming) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const result = await renameTeamAction(teamId, name);
          if ("error" in result) {
            alert(result.error);
            setPending(false);
            return;
          }
          setRenaming(false);
          router.refresh();
          setPending(false);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-moss focus:ring-1 focus:ring-moss"
          autoFocus
        />
        <Button type="submit" variant="secondary" loading={pending}>
          Enregistrer
        </Button>
        <Button type="button" variant="ghost" onClick={() => setRenaming(false)} disabled={pending}>
          Annuler
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setRenaming(true)}>
        Renommer
      </Button>
      <Button
        variant="ghost"
        loading={pending}
        onClick={async () => {
          if (!confirm(`Supprimer l'équipe « ${currentName} » ? Cette action est irréversible.`)) return;
          setPending(true);
          await deleteTeamAction(teamId);
          router.push("/coach/equipes");
        }}
      >
        Supprimer
      </Button>
    </div>
  );
}
