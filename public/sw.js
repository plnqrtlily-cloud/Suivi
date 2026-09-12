// Service worker volontairement minimal : son seul rôle ici est de satisfaire le
// critère technique d'installabilité PWA de Chrome/Android (un service worker actif
// avec un handler fetch). Pas de cache offline avancé pour ce prototype — l'app a de
// toute façon besoin du serveur (base de données, sessions) pour fonctionner, un vrai
// mode hors-ligne n'aurait de sens qu'avec une réécriture applicative plus large
// (cf. "PWA hors-ligne" dans la liste des points post-MVP du README).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// Notifications système (Web Push) — le payload est le JSON envoyé par
// sendPushToUser côté serveur : { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "Rythme" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // Payload non-JSON (ne devrait pas arriver, notre serveur envoie toujours
    // du JSON) — on retombe sur le titre par défaut plutôt que d'échouer.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rythme", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
