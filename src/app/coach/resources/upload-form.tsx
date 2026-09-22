"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadResourceAction } from "@/lib/actions";
import { Field, SelectField, TextAreaField, Button, ErrorText } from "@/components/ui";

export function UploadResourceForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<"video" | "photo" | "equipment">("photo");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    const result = await uploadResourceAction(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      formRef.current?.reset();
      router.refresh();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SelectField label="Type" name="type" value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="photo">Photo</option>
        <option value="video">Vidéo</option>
        <option value="equipment">Matériel</option>
      </SelectField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Titre" name="title" required placeholder="ex. Squat — vue de face" />
        <Field label="Sport concerné (facultatif)" name="sport" placeholder="ex. Musculation" />
      </div>

      <TextAreaField label="Description (facultatif)" name="description" rows={2} />

      {type !== "equipment" ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">Fichier ({type === "video" ? "vidéo" : "image"})</span>
          <input
            type="file"
            name="file"
            required
            accept={type === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">Photo du matériel (facultatif)</span>
          <input type="file" name="file" accept="image/*" className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
        </label>
      )}

      <ErrorText>{error}</ErrorText>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Ajouter à la bibliothèque"}
        </Button>
      </div>
    </form>
  );
}
