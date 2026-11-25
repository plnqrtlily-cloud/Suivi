"use client";

import { MoreMenu, MenuSeparator, menuItem } from "@/components/more-menu";
import { EditImportedActivityModal, DeleteImportedActivityButton, type EditableActivity } from "@/components/imported-activity-modal";
import { EditAvailabilityModal, type ExistingBlock } from "@/components/availability-modal";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";
import { PickDaysButton } from "@/components/pick-days-button";
import { duplicateImportedActivityAction, moveImportedActivityAction, moveWorkoutAction } from "@/lib/actions";

// Menus « ⋯ » des lignes du calendrier : Modifier, puis Supprimer.

export function ActivityMenu({ activity }: { activity: EditableActivity }) {
  return (
    <MoreMenu small label="Actions sur l'activité">
      <ActivityMenuItems activity={activity} />
      <MenuSeparator />
      <DeleteImportedActivityButton id={activity.id} className={`${menuItem} !text-[#a4492a]`}>Supprimer</DeleteImportedActivityButton>
    </MoreMenu>
  );
}

export function AvailabilityMenu({ block, isFemale }: { block: ExistingBlock; isFemale?: boolean }) {
  return (
    <MoreMenu small label="Actions sur l'indisponibilité">
      <EditAvailabilityModal block={block} isFemale={isFemale} className={menuItem}>Modifier</EditAvailabilityModal>
      <MenuSeparator />
      <DeleteAvailabilityButton id={block.id} className={`${menuItem} !text-[#a4492a]`}>Supprimer</DeleteAvailabilityButton>
    </MoreMenu>
  );
}

/** Modifier, Copier, Déplacer / reporter d'une activité faite (sans Supprimer). */
export function ActivityMenuItems({ activity }: { activity: EditableActivity }) {
  return (
    <>
      <EditImportedActivityModal activity={activity} className={menuItem}>Modifier</EditImportedActivityModal>
      <PickDaysButton className={menuItem} title="Copier l'activité" multiple confirmLabel="Copier" onPick={(d) => duplicateImportedActivityAction(activity.id, d)}>
        Copier…
      </PickDaysButton>
      <PickDaysButton className={menuItem} title="Déplacer l'activité" initial={activity.activity_date} confirmLabel="Déplacer" onPick={(d) => moveImportedActivityAction(activity.id, d[0])}>
        Déplacer / reporter…
      </PickDaysButton>
    </>
  );
}

/** Déplacer / reporter une séance programmée (coach). */
export function MoveWorkoutItem({ workoutId, date }: { workoutId: string; date: string }) {
  return (
    <PickDaysButton className={menuItem} title="Déplacer la séance" initial={date} confirmLabel="Déplacer" onPick={(d) => moveWorkoutAction({ workoutId, date: d[0] })}>
      Déplacer / reporter…
    </PickDaysButton>
  );
}
