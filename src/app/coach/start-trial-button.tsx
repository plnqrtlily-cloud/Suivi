"use client";

import { useRouter } from "next/navigation";
import { startTrialAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function StartTrialButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const result = await startTrialAction();
        if ("error" in result) {
          alert(result.error);
          return;
        }
        router.refresh();
      }}
    >
      Essayer le plan Pro (30 jours)
    </Button>
  );
}
