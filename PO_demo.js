/* =====================================================================
   Univers BFS — demo.js
   Jeu de données fictif permettant de faire tourner le portail sans
   aucune base. Sert de vitrine et de terrain d'essai.

   Rien n'est enregistré : tout repart à zéro au rechargement.
   Ce fichier peut être supprimé une fois le portail en production
   (retirer aussi sa ligne <script> dans index.html).
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.demo = (function () {
  'use strict';

  function id() { return 'demo-' + Math.random().toString(36).slice(2, 10); }

  var etat = {
    utilisateur: {
      id: 'demo-agent',
      email: 'agent@bfs-demo.fr'
    },
    profil: {
      id: 'demo-agent',
      email: 'agent@bfs-demo.fr',
      prenom: 'Jérémy',
      nom: 'Démo',
      fonction: 'Formateur / IPRP',
      agence: 'Bocage',
      role: 'admin',
      actif: true
    },
    applications: [
      {
        id: 'app-1', code: 'bfs-controle', nom: 'BFS Contrôle',
        description: "Vérification et suivi des équipements de sécurité — poste bureau.",
        url: 'https://bfsfortecjb.github.io/BFS-controle/',
        couleur: '#b2181a', initiales: 'BC', icone_url: null,
        type: 'interne', supporte_jeton: false, ordre: 10, actif: true
      },
      {
        id: 'app-2', code: 'bfs-controle-terrain', nom: 'BFS Contrôle — Terrain',
        description: 'Sessions de vérification sur site, utilisable hors connexion.',
        url: 'https://bfsfortecjb.github.io/BFS-controle/terrain.html',
        couleur: '#464645', initiales: 'BT', icone_url: null,
        type: 'interne', supporte_jeton: false, ordre: 20, actif: true
      },
      {
        id: 'app-3', code: 'bfs-habelec', nom: 'BFS Habelec',
        description: 'Certification et habilitation électrique. En cours de développement.',
        url: 'https://example.invalid/bfs-habelec',
        couleur: '#f3ab12', initiales: 'BH', icone_url: null,
        type: 'interne', supporte_jeton: false, ordre: 30, actif: true
      },
      {
        id: 'app-4', code: 'vgp-cloud', nom: 'VGP Cloud',
        description: 'Service externe de gestion des vérifications générales périodiques.',
        url: 'https://www.vgp-cloud.com/',
        couleur: '#080808', initiales: 'VG', icone_url: null,
        type: 'externe', supporte_jeton: false, ordre: 40, actif: true
      }
    ],
    connexions: [
      {
        id: 'cnx-1', user_id: 'demo-agent', application_id: 'app-1',
        statut: 'active', ordre: 10, identifiant_distant: 'agent@bfs-demo.fr',
        connecte_le: new Date(Date.now() - 86400000 * 24).toISOString(),
        dernier_acces: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'cnx-2', user_id: 'demo-agent', application_id: 'app-2',
        statut: 'active', ordre: 20, identifiant_distant: 'agent@bfs-demo.fr',
        connecte_le: new Date(Date.now() - 86400000 * 24).toISOString(),
        dernier_acces: new Date().toISOString()
      }
    ],
    agents: [
      { id: 'demo-agent', email: 'agent@bfs-demo.fr', prenom: 'Jérémy', nom: 'Démo',
        fonction: 'Formateur / IPRP', agence: 'Bocage', role: 'admin', actif: true },
      { id: 'demo-2', email: 'technicien@bfs-demo.fr', prenom: 'Karim', nom: 'Exemple',
        fonction: 'Technicien vérificateur', agence: 'Finistère', role: 'agent', actif: true },
      { id: 'demo-3', email: 'secretariat@bfs-demo.fr', prenom: 'Claire', nom: 'Exemple',
        fonction: 'Secrétariat', agence: 'Bocage', role: 'agent', actif: true }
    ]
  };

  function attendre(valeur) {
    return new Promise(function (r) { setTimeout(function () { r(valeur); }, 160); });
  }

  /* Implémente exactement la même interface que la couche Supabase. */
  var api = {
    /* --- Authentification --- */
    sessionActuelle: function () { return attendre(null); },

    connexion: function () {
      return attendre({ utilisateur: etat.utilisateur });
    },

    inscription: function () {
      return Promise.reject(new Error(
        "Création de compte indisponible en mode démonstration."));
    },

    deconnexion: function () { return attendre(true); },

    reinitialiserMdp: function () {
      return Promise.reject(new Error("Indisponible en mode démonstration."));
    },

    changerMdp: function () {
      return Promise.reject(new Error("Indisponible en mode démonstration."));
    },

    /* --- Profil --- */
    chargerProfil: function () { return attendre(Object.assign({}, etat.profil)); },

    majProfil: function (champs) {
      Object.assign(etat.profil, champs);
      var a = etat.agents.find(function (x) { return x.id === etat.profil.id; });
      if (a) Object.assign(a, champs);
      return attendre(Object.assign({}, etat.profil));
    },

    /* --- Applications --- */
    listerApplications: function () {
      return attendre(etat.applications.slice().sort(function (a, b) { return a.ordre - b.ordre; }));
    },

    enregistrerApplication: function (app) {
      if (app.id) {
        var i = etat.applications.findIndex(function (x) { return x.id === app.id; });
        if (i > -1) etat.applications[i] = Object.assign({}, etat.applications[i], app);
      } else {
        etat.applications.push(Object.assign({ id: id(), actif: true }, app));
      }
      return attendre(true);
    },

    supprimerApplication: function (appId) {
      etat.applications = etat.applications.filter(function (x) { return x.id !== appId; });
      etat.connexions = etat.connexions.filter(function (c) { return c.application_id !== appId; });
      return attendre(true);
    },

    /* --- Connexions de l'agent --- */
    listerConnexions: function () {
      return attendre(etat.connexions.map(function (c) {
        return Object.assign({}, c, {
          applications: etat.applications.find(function (a) { return a.id === c.application_id; })
        });
      }));
    },

    ajouterConnexion: function (appId, identifiant) {
      if (etat.connexions.some(function (c) { return c.application_id === appId; })) {
        return Promise.reject(new Error('Cette brique est déjà connectée.'));
      }
      etat.connexions.push({
        id: id(), user_id: etat.utilisateur.id, application_id: appId,
        statut: 'active', ordre: 100, identifiant_distant: identifiant || null,
        connecte_le: new Date().toISOString(), dernier_acces: null
      });
      return attendre(true);
    },

    retirerConnexion: function (cnxId) {
      etat.connexions = etat.connexions.filter(function (c) { return c.id !== cnxId; });
      return attendre(true);
    },

    toucherAcces: function (cnxId) {
      var c = etat.connexions.find(function (x) { return x.id === cnxId; });
      if (c) c.dernier_acces = new Date().toISOString();
      return Promise.resolve(true);
    },

    /* --- Administration --- */
    listerAgents: function () { return attendre(etat.agents.slice()); },

    majAgent: function (agentId, champs) {
      var a = etat.agents.find(function (x) { return x.id === agentId; });
      if (a) Object.assign(a, champs);
      return attendre(true);
    },

    /* --- Journal --- */
    journaliser: function () { return Promise.resolve(true); }
  };

  return { etat: etat, api: api };
})();

BFS.debug.info('demo.js chargé.');
