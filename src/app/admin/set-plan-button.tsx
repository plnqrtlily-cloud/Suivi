"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCoachPlanAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function SetPlanButton({ coachId, currentPlan }: { coachId: string; currentPlan: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (currentPlan === "pro") {
    return (
      <Button
        variant="ghost"
        loading={pending}
        onClick={async () => {
          if (!confirm("Repasser ce coach en offre gratuite ?")) return;
          setPending(true);
          await setCoachPlanAction(coachId, "free");
          router.refresh();
          setPending(false);
        }}
      >
        Repasser gratuit
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        await setCoachPlanAction(coachId, "pro");
        router.refresh();
        setPending(false);
      }}
    >
      Passer Pro
    </Button>
  );
}
