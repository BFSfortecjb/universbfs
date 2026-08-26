/* =====================================================================
   Univers BFS — app.js
   Démarrage du portail : câblage des actions, restauration de session,
   enregistrement du service worker.

   Chargé en dernier : tous les autres modules sont disponibles ici.
   ===================================================================== */

(function () {
  'use strict';

  var $ = BFS.core.$;

  /* ------------------------------------------------------------------
     Actions globales (attribut data-action)
     ------------------------------------------------------------------ */
  function cablerActions() {
    document.addEventListener('click', function (e) {
      var cible = e.target.closest('[data-action]');
      if (!cible) return;
      var action = cible.dataset.action;

      switch (action) {
        case 'aller-dashboard':
          BFS.core.montrerPage('page-dashboard');
          BFS.applications.rafraichirTableauDeBord();
          break;

        case 'aller-catalogue':
          BFS.applications.afficherCatalogue();
          break;

        case 'aller-profil':
          fermerMenuProfil();
          BFS.core.montrerPage('page-profil');
          break;

        case 'aller-admin':
          fermerMenuProfil();
          BFS.admin.afficher();
          break;

        case 'nouvelle-app':
          BFS.admin.nouvelleApplication();
          break;

        case 'provisionner-compte':
          BFS.admin.provisionnerCompte();
          break;

        case 'fermer-modale':
          BFS.core.fermerModale();
          break;
      }
    });

    /* Menu profil */
    $('#btn-menu-profil').addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = $('#menu-profil');
      var ouvert = !menu.hidden;
      menu.hidden = ouvert;
      $('#btn-menu-profil').setAttribute('aria-expanded', String(!ouvert));
    });

    document.addEventListener('click', function (e) {
      var menu = $('#menu-profil');
      if (!menu.hidden && !menu.contains(e.target) && e.target !== $('#btn-menu-profil')) {
        fermerMenuProfil();
      }
    });

    /* Échap ferme la modale puis le menu */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#modale').hidden) { BFS.core.fermerModale(); return; }
      fermerMenuProfil();
    });
  }

  function fermerMenuProfil() {
    $('#menu-profil').hidden = true;
    $('#btn-menu-profil').setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------------
     Service worker (PWA)
     ------------------------------------------------------------------ */
  function enregistrerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      BFS.debug.info('Service worker ignoré : le HTTPS est requis.');
      return;
    }
    navigator.serviceWorker.register('PO_service-worker.js')
      .then(function (reg) { BFS.debug.info('Service worker enregistré, portée :', reg.scope); })
      .catch(function (err) { BFS.debug.erreur('Service worker non enregistré :', err.message); });
  }

  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  async function demarrer() {
    BFS.debug.info('Démarrage du portail — version', BFS.config.VERSION);

    BFS.core.initClient();
    BFS.core.surveillerReseau();

    cablerActions();
    BFS.auth.initEcran();
    BFS.auth.initFormulaireProfil();
    BFS.admin.initOnglets();

    /* Le mode démonstration n'ouvre jamais de session tout seul :
       l'utilisateur clique sur « Entrer en démonstration ». */
    if (BFS.config.MODE_DEMO) {
      BFS.core.montrerVue('vue-connexion');
      return;
    }

    if (!BFS.core.client) {
      BFS.core.montrerVue('vue-connexion');
      BFS.core.message('#message-auth',
        "Le portail n'arrive pas à joindre sa base de données. " +
        "Vérifiez le fichier PO_config.js et votre connexion internet.", 'erreur');
      return;
    }

    /* Session déjà ouverte ? */
    try {
      var session = await BFS.donnees.sessionActuelle();
      if (session) {
        BFS.debug.info('Session existante retrouvée.');
        await BFS.auth.demarrerSession();
      } else {
        BFS.core.montrerVue('vue-connexion');
      }
    } catch (err) {
      BFS.debug.erreur('Restauration de session impossible :', err.message);
      BFS.core.montrerVue('vue-connexion');
    }

    /* Déconnexion depuis un autre onglet, expiration de session… */
    BFS.core.client.auth.onAuthStateChange(function (evenement) {
      BFS.debug.log('Événement d\'authentification :', evenement);
      if (evenement === 'SIGNED_OUT') location.reload();
    });

    enregistrerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
