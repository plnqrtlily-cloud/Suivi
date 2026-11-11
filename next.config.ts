import type { NextConfig } from "next";
import { TEAMS_ENABLED } from "./src/lib/features";

// La limite par défaut des Server Actions Next.js est 1 Mo, ce qui bloquait
// silencieusement l'upload de toute vraie photo/vidéo vers la bibliothèque de
// ressources. Alignée ici sur MAX_FILE_SIZE_BYTES (50 Mo, src/lib/storage.ts),
// avec une marge pour l'overhead du multipart.
//
// allowedOrigins autorise les Server Actions (formulaires, connexion, création de
// séance, etc.) à fonctionner via le lien public temporaire (cf. "Lancer
// l'application.command", tunnel cloudflared *.trycloudflare.com) — sans cette
// autorisation explicite, Next.js bloque les Server Actions par sécurité anti-CSRF
// dès que l'origine de la requête (le domaine trycloudflare.com vu par le
// navigateur) diffère de l'hôte local attendu.
const nextConfig: NextConfig = {
  experimental: {
    // Revenir sur un onglet déjà ouvert (Aujourd'hui, Calendrier, Messages…)
    // s'affiche tout de suite pendant 30 s au lieu de tout recalculer ; une
    // action qui modifie les données invalide ce cache.
    staleTimes: { dynamic: 30 },
    serverActions: {
      bodySizeLimit: "55mb",
      allowedOrigins: ["*.trycloudflare.com"],
    },
  },
  // Équipes mises de côté : les adresses /coach/equipes renvoient au tableau de bord.
  async redirects() {
    return TEAMS_ENABLED
      ? []
      : [
          { source: "/coach/equipes", destination: "/coach/dashboard", permanent: false },
          { source: "/coach/equipes/:path*", destination: "/coach/dashboard", permanent: false },
        ];
  },
};

export default nextConfig;
