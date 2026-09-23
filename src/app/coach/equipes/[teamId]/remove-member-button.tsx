"use client";

import { useRouter } from "next/navigation";
import { removeTeamMemberAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        if (!confirm("Retirer ce joueur de l'équipe ?")) return;
        await removeTeamMemberAction(memberId);
        router.refresh();
      }}
    >
      Retirer
    </Button>
  );
}
