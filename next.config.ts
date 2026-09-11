import type { NextConfig } from "next";

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
    serverActions: {
      bodySizeLimit: "55mb",
      allowedOrigins: ["*.trycloudflare.com"],
    },
  },
};

export default nextConfig;
