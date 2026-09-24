import { ViewTransition } from "react";

// Sans ce template propre à /coach, seule la traversée du tout premier
// segment (ex. /tarifs -> /coach/dashboard) aurait un fondu : un layout
// persiste entre routes et ne remonte jamais, donc app/template.tsx seul ne
// captait pas la navigation entre pages coach elles-mêmes (dashboard <->
// équipes <-> planification...), pourtant la plus fréquente au quotidien.
export default function CoachTemplate({ children }: { children: React.ReactNode }) {
  return <ViewTransition>{children}</ViewTransition>;
}
