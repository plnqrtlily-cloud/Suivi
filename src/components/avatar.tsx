const SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-base",
  lg: "h-24 w-24 text-3xl",
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
  size?: "sm" | "md" | "lg";
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
  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-moss/15 font-display font-medium text-moss-dark`}
    >
      {firstName.charAt(0).toUpperCase()}
    </div>
  );
}
