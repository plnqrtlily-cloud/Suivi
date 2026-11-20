"use client";

import { MoreMenu, MenuSeparator, menuItem } from "@/components/more-menu";
import { EditImportedActivityModal, DeleteImportedActivityButton, type EditableActivity } from "@/components/imported-activity-modal";
import { EditAvailabilityModal, type ExistingBlock } from "@/components/availability-modal";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";

// Menus « ⋯ » des lignes du calendrier : Modifier, puis Supprimer.

export function ActivityMenu({ activity }: { activity: EditableActivity }) {
  return (
    <MoreMenu small label="Actions sur l'activité">
      <EditImportedActivityModal activity={activity} className={menuItem}>Modifier</EditImportedActivityModal>
      <MenuSeparator />
      <DeleteImportedActivityButton id={activity.id} className={`${menuItem} !text-[#a4492a]`}>Supprimer</DeleteImportedActivityButton>
    </MoreMenu>
  );
}

export function AvailabilityMenu({ block }: { block: ExistingBlock }) {
  return (
    <MoreMenu small label="Actions sur l'indisponibilité">
      <EditAvailabilityModal block={block} className={menuItem}>Modifier</EditAvailabilityModal>
      <MenuSeparator />
      <DeleteAvailabilityButton id={block.id} className={`${menuItem} !text-[#a4492a]`}>Supprimer</DeleteAvailabilityButton>
    </MoreMenu>
  );
}
