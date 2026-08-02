/* =====================================================================
   Univers BFS — debug.js
   Journal de bord technique. Chargé en tout premier pour pouvoir
   tracer ce qui se passe dans les fichiers suivants.

   Pour activer les traces détaillées : ajouter ?debug=1 à l'URL.
   Les erreurs sont toujours tracées, même sans ?debug=1.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.debug = (function () {
  'use strict';

  var actif = false;
  try {
    actif = new URLSearchParams(location.search).has('debug') ||
            localStorage.getItem('univers_debug') === '1';
  } catch (e) { /* localStorage indisponible : on reste silencieux */ }

  var historique = [];

  function empiler(niveau, args) {
    historique.push({
      heure: new Date().toISOString(),
      niveau: niveau,
      message: Array.prototype.map.call(args, function (a) {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
        catch (e) { return '[objet non sérialisable]'; }
      }).join(' ')
    });
    if (historique.length > 300) historique.shift();
  }

  return {
    actif: actif,

    log: function () {
      empiler('log', arguments);
      if (actif) console.log('%c[BFS]', 'color:#f3ab12;font-weight:700', ...arguments);
    },

    info: function () {
      empiler('info', arguments);
      if (actif) console.info('%c[BFS]', 'color:#464645;font-weight:700', ...arguments);
    },

    erreur: function () {
      empiler('erreur', arguments);
      console.error('%c[BFS]', 'color:#b2181a;font-weight:700', ...arguments);
    },

    /* Active les traces de façon persistante (à taper dans la console). */
    activer: function () {
      try { localStorage.setItem('univers_debug', '1'); } catch (e) {}
      location.reload();
    },

    desactiver: function () {
      try { localStorage.removeItem('univers_debug'); } catch (e) {}
      location.reload();
    },

    /* Renvoie tout l'historique — utile pour un copier-coller de diagnostic. */
    historique: function () { return historique.slice(); },

    rapport: function () {
      return historique.map(function (l) {
        return l.heure + ' [' + l.niveau + '] ' + l.message;
      }).join('\n');
    }
  };
})();

window.addEventListener('error', function (e) {
  BFS.debug.erreur('Erreur JS non interceptée :', e.message, '@', e.filename + ':' + e.lineno);
});

window.addEventListener('unhandledrejection', function (e) {
  BFS.debug.erreur('Promesse rejetée non interceptée :', e.reason && e.reason.message || e.reason);
});

BFS.debug.info('debug.js chargé — traces détaillées :', BFS.debug.actif ? 'ACTIVES' : 'inactives (ajouter ?debug=1)');
