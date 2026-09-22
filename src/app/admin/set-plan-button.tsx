"use client";

import { useRouter } from "next/navigation";
import { setCoachPlanAction } from "@/lib/actions";
import { Button } from "@/components/ui";

export function SetPlanButton({ coachId, currentPlan }: { coachId: string; currentPlan: string }) {
  const router = useRouter();

  if (currentPlan === "pro") {
    return (
      <Button
        variant="ghost"
        onClick={async () => {
          if (!confirm("Repasser ce coach en offre gratuite ?")) return;
          await setCoachPlanAction(coachId, "free");
          router.refresh();
        }}
      >
        Repasser gratuit
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await setCoachPlanAction(coachId, "pro");
        router.refresh();
      }}
    >
      Passer Pro
    </Button>
  );
}
