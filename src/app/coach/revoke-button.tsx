"use client";

import { useState } from "react";
import { revokeAthleteAccessAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RevokeButton({ linkId, label }: { linkId: string; label: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={async () => {
        if (!confirm("Confirmer cette action ?")) return;
        setPending(true);
        await revokeAthleteAccessAction(linkId);
        setPending(false);
      }}
    >
      {label}
    </Button>
  );
}
