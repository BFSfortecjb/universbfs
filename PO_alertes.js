/* =====================================================================
   Univers BFS — alertes.js
   Bloc « À traiter » du tableau de bord : rassemble les points
   importants des briques auxquelles l'agent a accès (échéances,
   éléments en attente).

   Principe : chaque brique expose une fonction de lecture
   <schema>.tableau_de_bord() qui ne renvoie que des libellés, des
   nombres et des dates (jamais de données de personnes). Le portail
   l'appelle avec la session de l'agent : une brique où l'agent n'a pas
   de profil ne renvoie rien, et une brique absente ou en erreur est
   simplement ignorée. Le portail n'accède jamais aux tables des briques.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.alertes = (function () {
  'use strict';

  var $ = BFS.core.$;
  var creer = BFS.core.creer;

  /* Schéma de la brique -> code de l'application dans portail.applications.
     Contrôle n'y figure pas volontairement : le travail chez les clients
     (extincteurs, etc.) ne remonte pas sur le tableau de bord. */
  var BRIQUES = [
    { schema: 'habelec',  code: 'bfs-habelec',  nom: 'Habelec' },
    { schema: 'caces',    code: 'bfs-caces',    nom: 'CACES' },
    { schema: 'pointage', code: 'pointage-bfs', nom: 'Pointage' },
    { schema: 'hse',      code: 'bfs-hse',      nom: 'HSE' },
    /* Portail : visible des administrateurs seulement (comptes à activer,
       agents sans brique). Un clic ouvre l'administration. */
    { schema: 'portail',  code: null,           nom: 'Portail', action: 'admin' }
  ];

  var ORDRE = { retard: 0, proche: 1, info: 2 };
  var LIBELLES = { retard: 'En retard', proche: 'À venir', info: 'À savoir' };

  async function lireBrique(b) {
    var r = await BFS.core.client.schema(b.schema).rpc('tableau_de_bord');
    if (r.error) throw r.error;
    return (r.data || []).slice(0, 20).map(function (l) {
      return {
        brique: b, categorie: l.categorie, libelle: l.libelle,
        nombre: l.nombre, echeance: l.echeance,
        urgence: ORDRE.hasOwnProperty(l.urgence) ? l.urgence : 'info'
      };
    });
  }

  async function rafraichir() {
    var bloc = $('#bloc-alertes');
    if (!bloc) return;
    if (!BFS.core.client) { bloc.hidden = true; return; }

    var apps = [];
    try { apps = await BFS.donnees.listerApplications(); } catch (e) { /* liens indisponibles */ }

    var resultats = await Promise.allSettled(BRIQUES.map(lireBrique));
    var lignes = [];
    resultats.forEach(function (r, i) {
      if (r.status === 'fulfilled') lignes = lignes.concat(r.value);
      else BFS.debug.log('Alertes ' + BRIQUES[i].schema + ' ignorées :', r.reason && r.reason.message);
    });

    lignes.sort(function (a, b) {
      return (ORDRE[a.urgence] - ORDRE[b.urgence]) ||
             String(a.echeance || '9999').localeCompare(String(b.echeance || '9999'));
    });

    var zone = $('#liste-alertes');
    zone.innerHTML = '';
    bloc.hidden = lignes.length === 0;
    if (!lignes.length) return;

    var groupe = null;
    lignes.forEach(function (l) {
      if (l.urgence !== groupe) {
        zone.appendChild(creer('h3', { classe: 'alerte-groupe ' + l.urgence, texte: LIBELLES[l.urgence] }));
        groupe = l.urgence;
      }
      zone.appendChild(ligne(l, apps));
    });
  }

  function ligne(l, apps) {
    var app = apps.filter(function (a) { return a.code === l.brique.code; })[0];
    var texte = (l.nombre > 1 ? l.nombre + ' × ' : '') + l.libelle;

    var el = creer('button', { classe: 'alerte-ligne ' + l.urgence, attributs: { type: 'button',
      title: app ? 'Ouvrir ' + app.nom : '' } });
    el.appendChild(creer('span', { classe: 'alerte-brique', texte: l.brique.nom }));
    el.appendChild(creer('span', { classe: 'alerte-texte', texte: texte }));
    if (l.echeance) el.appendChild(creer('span', { classe: 'alerte-date', texte: BFS.core.dateCourte(l.echeance) }));

    if (l.brique.action === 'admin') {
      el.addEventListener('click', function () { BFS.admin.afficher(); });
    } else if (app && BFS.core.estUrlValide(app.url)) {
      el.addEventListener('click', function () {
        var onglet = window.open(app.url, '_blank');
        if (onglet) onglet.opener = null; else location.href = app.url;
      });
    }
    return el;
  }

  return { rafraichir: rafraichir };
})();

BFS.debug.info('alertes.js chargé.');
