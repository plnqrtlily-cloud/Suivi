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
