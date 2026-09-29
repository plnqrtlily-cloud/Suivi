/** Texte d'aperçu d'un message (liste des conversations, alertes) — une pièce jointe seule n'a pas de texte. */
export function messagePreview(m: { body?: string | null; media_type?: string | null; media_name?: string | null }): string {
  if (m.body) return m.body;
  if (m.media_type === "video") return "Vidéo";
  if (m.media_type === "document") return m.media_name ? `Document : ${m.media_name}` : "Document";
  if (m.media_type === "image") return "Photo";
  return "";
}
