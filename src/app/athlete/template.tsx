import { ViewTransition } from "react";

// Voir coach/template.tsx : même besoin côté athlète (accueil <->
// programmation <-> messagerie...).
export default function AthleteTemplate({ children }: { children: React.ReactNode }) {
  return <ViewTransition>{children}</ViewTransition>;
}
