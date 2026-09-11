import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rythme — Coach & Athlète",
  description: "Planification d'entraînement et suivi de performance entre coach et athlète.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rythme",
  },
  icons: {
    // ?v=2 : force les navigateurs/PWA à re-télécharger l'icône après le
    // changement de palette (pétrole/corail) plutôt que de garder l'ancienne
    // en cache — un appareil où l'app est déjà installée sur l'écran d'accueil
    // devra tout de même la retirer puis la réinstaller pour la voir changer.
    icon: [
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B4B4F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
