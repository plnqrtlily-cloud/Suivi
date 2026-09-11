"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatarAction, deleteAvatarAction } from "@/lib/actions";
import { Avatar } from "@/components/avatar";
import { Button, ErrorText } from "@/components/ui";

export function AvatarUpload({
  userId,
  firstName,
  hasAvatar,
}: {
  userId: string;
  firstName: string;
  hasAvatar: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(undefined);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadAvatarAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleRemove() {
    setPending(true);
    await deleteAvatarAction();
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar userId={userId} firstName={firstName} hasAvatar={hasAvatar} size="lg" />
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={pending}>
          {pending ? "Envoi…" : hasAvatar ? "Changer la photo" : "Ajouter une photo"}
        </Button>
        {hasAvatar && (
          <Button type="button" variant="ghost" className="text-clay" onClick={handleRemove} disabled={pending}>
            Retirer la photo
          </Button>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}
