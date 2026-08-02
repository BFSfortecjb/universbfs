/* =====================================================================
   Univers BFS — core.js
   Briques de base réutilisées partout : client Supabase, raccourcis DOM,
   notifications, modale, petits utilitaires.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.core = (function () {
  'use strict';

  /* ------------------------------------------------------------------
     Client Supabase
     ------------------------------------------------------------------ */
  var client = null;

  function initClient() {
    if (BFS.config.MODE_DEMO) {
      BFS.debug.info('Mode démonstration : aucun client Supabase créé.');
      return null;
    }
    if (typeof window.supabase === 'undefined') {
      BFS.debug.erreur('La librairie Supabase ne s\'est pas chargée (CDN bloqué ?).');
      return null;
    }
    client = window.supabase.createClient(
      BFS.config.SUPABASE_URL,
      BFS.config.SUPABASE_ANON_KEY,
      {
        db: {
          schema: BFS.config.SUPABASE_SCHEMA || 'portail'
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'bfs-univers-auth'
        }
      }
    );
    BFS.debug.info('Client Supabase créé.');
    return client;
  }

  /* ------------------------------------------------------------------
     Raccourcis DOM
     ------------------------------------------------------------------ */
  function $(selecteur, racine) { return (racine || document).querySelector(selecteur); }
  function $$(selecteur, racine) {
    return Array.prototype.slice.call((racine || document).querySelectorAll(selecteur));
  }

  function creer(balise, options) {
    var el = document.createElement(balise);
    options = options || {};
    if (options.classe) el.className = options.classe;
    if (options.texte) el.textContent = options.texte;
    if (options.html) el.innerHTML = options.html;
    if (options.attributs) {
      Object.keys(options.attributs).forEach(function (k) {
        el.setAttribute(k, options.attributs[k]);
      });
    }
    if (options.style) {
      Object.keys(options.style).forEach(function (k) {
        el.style.setProperty(k, options.style[k]);
      });
    }
    (options.enfants || []).forEach(function (enfant) { el.appendChild(enfant); });
    return el;
  }

  /* Échappe le texte destiné à innerHTML. */
  function echapper(texte) {
    var d = document.createElement('div');
    d.textContent = texte == null ? '' : String(texte);
    return d.innerHTML;
  }

  /* ------------------------------------------------------------------
     Navigation entre vues et pages
     ------------------------------------------------------------------ */
  function montrerVue(idVue) {
    $$('.vue').forEach(function (v) { v.classList.toggle('active', v.id === idVue); });
    BFS.debug.log('Vue affichée :', idVue);
  }

  function montrerPage(idPage) {
    $$('.page').forEach(function (p) { p.classList.toggle('active', p.id === idPage); });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    BFS.debug.log('Page affichée :', idPage);
  }

  /* ------------------------------------------------------------------
     Notifications
     ------------------------------------------------------------------ */
  function notifier(message, type, duree) {
    var zone = $('#notifications');
    if (!zone) return;
    var n = creer('div', { classe: 'notification ' + (type || ''), texte: message });
    zone.appendChild(n);
    setTimeout(function () {
      n.style.opacity = '0';
      n.style.transition = 'opacity .25s';
      setTimeout(function () { n.remove(); }, 250);
    }, duree || 3600);
  }

  /* ------------------------------------------------------------------
     Messages inline (écran de connexion)
     ------------------------------------------------------------------ */
  function message(idElement, texte, type) {
    var el = $(idElement);
    if (!el) return;
    if (!texte) { el.hidden = true; el.textContent = ''; return; }
    el.className = 'message ' + (type || 'info');
    el.textContent = texte;
    el.hidden = false;
  }

  /* ------------------------------------------------------------------
     Modale générique
     ------------------------------------------------------------------ */
  function ouvrirModale(titre, corpsHTML, boutons) {
    $('#modale-titre').textContent = titre;
    $('#modale-corps').innerHTML = corpsHTML || '';

    var pied = $('#modale-pied');
    pied.innerHTML = '';
    (boutons || []).forEach(function (b) {
      var btn = creer('button', { classe: 'btn ' + (b.classe || 'btn-secondaire'), texte: b.libelle });
      btn.addEventListener('click', function () { b.action && b.action(); });
      pied.appendChild(btn);
    });
    pied.hidden = !(boutons && boutons.length);

    $('#modale').hidden = false;
  }

  function fermerModale() {
    $('#modale').hidden = true;
    $('#modale-corps').innerHTML = '';
    $('#modale-pied').innerHTML = '';
  }

  /* ------------------------------------------------------------------
     Utilitaires
     ------------------------------------------------------------------ */
  function initiales(prenom, nom, secours) {
    var p = (prenom || '').trim();
    var n = (nom || '').trim();
    if (p || n) return ((p[0] || '') + (n[0] || '')).toUpperCase();
    return (secours || '?').substring(0, 2).toUpperCase();
  }

  function dateCourte(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch (e) { return '—'; }
  }

  function depuis(iso) {
    if (!iso) return 'jamais ouvert';
    var ecart = Date.now() - new Date(iso).getTime();
    var jours = Math.floor(ecart / 86400000);
    if (jours <= 0)  return "ouvert aujourd'hui";
    if (jours === 1) return 'ouvert hier';
    if (jours < 31)  return 'ouvert il y a ' + jours + ' jours';
    return 'ouvert le ' + dateCourte(iso);
  }

  /* Traduit les messages d'erreur Supabase en français compréhensible. */
  function traduireErreur(err) {
    var m = (err && (err.message || err.error_description) || '').toLowerCase();
    if (m.indexOf('invalid login credentials') > -1) return 'Adresse e-mail ou mot de passe incorrect.';
    if (m.indexOf('email not confirmed') > -1)       return "Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre boîte de réception.";
    if (m.indexOf('user already registered') > -1)   return 'Un compte existe déjà avec cette adresse e-mail.';
    if (m.indexOf('password should be at least') > -1) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (m.indexOf('rate limit') > -1 || m.indexOf('too many') > -1) return 'Trop de tentatives. Patientez quelques minutes.';
    if (m.indexOf('failed to fetch') > -1)           return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.';
    if (m.indexOf('row-level security') > -1)        return "Vous n'avez pas les droits nécessaires pour cette action.";
    return (err && err.message) || 'Une erreur inattendue est survenue.';
  }

  function estUrlValide(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------
     Réseau
     ------------------------------------------------------------------ */
  function surveillerReseau() {
    function maj() {
      var p = $('#etat-reseau');
      if (!p) return;
      var horsLigne = !navigator.onLine;
      p.classList.toggle('hors-ligne', horsLigne);
      p.title = horsLigne ? 'Hors connexion' : 'Connecté';
    }
    window.addEventListener('online', function () { maj(); notifier('Connexion rétablie.', 'succes'); });
    window.addEventListener('offline', function () { maj(); notifier('Vous êtes hors connexion.', 'erreur'); });
    maj();
  }

  /* ------------------------------------------------------------------ */
  return {
    initClient: initClient,
    get client() { return client; },
    $: $, $$: $$, creer: creer, echapper: echapper,
    montrerVue: montrerVue, montrerPage: montrerPage,
    notifier: notifier, message: message,
    ouvrirModale: ouvrirModale, fermerModale: fermerModale,
    initiales: initiales, dateCourte: dateCourte, depuis: depuis,
    traduireErreur: traduireErreur, estUrlValide: estUrlValide,
    surveillerReseau: surveillerReseau
  };
})();

BFS.debug.info('core.js chargé.');
