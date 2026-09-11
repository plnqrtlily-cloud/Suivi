"use client";

import { useRouter } from "next/navigation";
import { revokeAthleteAccessAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RevokeButton({ linkId, label }: { linkId: string; label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        if (!confirm("Confirmer cette action ?")) return;
        await revokeAthleteAccessAction(linkId);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
