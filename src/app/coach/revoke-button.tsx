"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revokeAthleteAccessAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RevokeButton({ linkId, label }: { linkId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={async () => {
        if (!confirm("Confirmer cette action ?")) return;
        setPending(true);
        await revokeAthleteAccessAction(linkId);
        router.refresh();
        setPending(false);
      }}
    >
      {label}
    </Button>
  );
}
