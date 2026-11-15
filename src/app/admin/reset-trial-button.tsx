"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetAthleteTrialAsAdminAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function ResetTrialButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={async () => {
        if (!confirm(`Redonner 3 mois d'essai à ${name} ? À utiliser pour un vrai changement de coach.`)) return;
        setPending(true);
        try {
          await resetAthleteTrialAsAdminAction(userId);
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      Réinitialiser l&apos;essai
    </Button>
  );
}
