/* =====================================================================
   Univers BFS — service-worker.js
   Rend le portail installable et utilisable même sans connexion.

   Stratégie retenue :
     - coquille de l'application (HTML, CSS, JS, icônes) : réseau
       d'abord, cache en secours. On voit donc toujours la dernière
       version dès qu'on est en ligne, et le portail s'ouvre quand
       même hors connexion.
     - tout le reste (appels Supabase, polices, CDN) : réseau seul.
       Rien de ce qui concerne les données ou l'authentification
       n'est mis en cache.

   IMPORTANT : incrémenter VERSION_CACHE à chaque mise en ligne, sinon
   les navigateurs qui ont déjà installé le portail garderont l'ancienne
   version.
   ===================================================================== */

const VERSION_CACHE = 'univers-bfs-v5';

const COQUILLE = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './PO_debug.js',
  './PO_config.js',
  './PO_core.js',
  './PO_demo.js',
  './PO_donnees.js',
  './PO_auth.js',
  './PO_applications.js',
  './PO_admin.js',
  './PO_app.js',
  './icons/logo-bfs.png',
  './icons/logo-bfs-blanc.png',
  './icons/icotype-bfs.png',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-180.png',
  './icons/favicon-32.png'
];

/* --- Installation : on met la coquille en cache --------------------- */
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(VERSION_CACHE)
      .then((cache) => cache.addAll(COQUILLE))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[BFS SW] Mise en cache incomplète :', err))
  );
});

/* --- Activation : on efface les anciennes versions ------------------ */
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((c) => c !== VERSION_CACHE).map((c) => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

/* --- Interception des requêtes -------------------------------------- */
self.addEventListener('fetch', (evt) => {
  const requete = evt.request;

  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);

  /* Jamais de cache pour ce qui touche aux données ou aux comptes. */
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/auth/') || url.pathname.includes('/rest/')) return;

  evt.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (reponse && reponse.status === 200 && reponse.type === 'basic') {
          const copie = reponse.clone();
          caches.open(VERSION_CACHE).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(requete).then((enCache) => {
        if (enCache) return enCache;
        /* Navigation hors connexion sans page en cache : on sert l'accueil. */
        if (requete.mode === 'navigate') return caches.match('./index.html');
        return new Response('Hors connexion', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }))
  );
});
