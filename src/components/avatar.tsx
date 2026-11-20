import { personTone } from "@/lib/palette";

const SIZES: Record<"sm" | "md" | "lg" | "list", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-base",
  lg: "h-24 w-24 text-3xl",
  // Listes d'athlètes : compact sur téléphone, grand portrait sur ordinateur.
  list: "h-12 w-12 text-base sm:h-24 sm:w-24 sm:text-3xl",
};

export function Avatar({
  userId,
  firstName,
  hasAvatar,
  size = "md",
}: {
  userId: string;
  firstName: string;
  hasAvatar: boolean;
  size?: "sm" | "md" | "lg" | "list";
}) {
  if (hasAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${userId}`}
        alt={firstName}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }
  // Sans photo : initiale sur un ton pastel propre à la personne.
  const tone = personTone(userId);
  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-display font-medium`}
      style={{ background: tone.tint, color: tone.color }}
    >
      {firstName.charAt(0).toUpperCase()}
    </div>
  );
}
