"use client";

import { useState } from "react";
import { removeTeamMemberAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={async () => {
        if (!confirm("Retirer ce joueur de l'équipe ?")) return;
        setPending(true);
        await removeTeamMemberAction(memberId);
        setPending(false);
      }}
    >
      Retirer
    </Button>
  );
}
