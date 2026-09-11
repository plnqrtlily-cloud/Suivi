"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteResourceAction } from "@/lib/actions";
import { Button } from "@/components/ui";

const TYPE_LABELS: Record<string, string> = { video: "Vidéo", photo: "Photo", equipment: "Matériel" };

export function ResourceCard({ resource }: { resource: any }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer « ${resource.title} » ?`)) return;
    setPending(true);
    await deleteResourceAction(resource.id);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-md border border-line bg-white">
      {resource.file_path && resource.type === "video" ? (
        <video controls className="aspect-video w-full bg-ink object-cover">
          <source src={`/api/resources/file/${resource.id}`} type={resource.mime_type} />
        </video>
      ) : resource.file_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/resources/file/${resource.id}`} alt={resource.title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-paper-dim text-xs text-slate">
          Pas de photo
        </div>
      )}
      <div className="p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-medium text-ink">{resource.title}</p>
          <span className="rounded-full bg-paper-dim px-2 py-0.5 text-xs text-slate">{TYPE_LABELS[resource.type]}</span>
        </div>
        {resource.sport && <p className="text-xs text-slate">{resource.sport}</p>}
        {resource.description && <p className="mt-1 text-sm text-ink-soft">{resource.description}</p>}
        <div className="mt-2">
          <Button variant="ghost" onClick={handleDelete} disabled={pending} className="text-clay">
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}
