import { ViewTransition } from "react";

// Active les transitions de page (cf. globals.css) : un template (contrairement
// à layout.tsx) est remonté à chaque changement de route, ce qui donne à React
// deux instances distinctes à faire fondre l'une dans l'autre. Placé ici (racine)
// pour les changements de premier segment (ex. /login -> /coach/dashboard,
// /coach/* -> /tarifs) ; voir aussi coach/template.tsx et athlete/template.tsx
// pour la navigation à l'intérieur de chaque espace, plus fréquente au quotidien.
export default function Template({ children }: { children: React.ReactNode }) {
  return <ViewTransition>{children}</ViewTransition>;
}
