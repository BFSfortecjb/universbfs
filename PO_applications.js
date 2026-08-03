/* =====================================================================
   Univers BFS — applications.js
   Tableau de bord (tuiles), catalogue des briques, ouverture d'une
   application.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.applications = (function () {
  'use strict';

  var $ = BFS.core.$;
  var creer = BFS.core.creer;

  var catalogue  = [];   // toutes les briques du catalogue
  var connexions = [];   // celles que l'agent a connectées

  /* ==================================================================
     TABLEAU DE BORD
     ================================================================== */

  async function rafraichirTableauDeBord() {
    try {
      var resultats = await Promise.all([
        BFS.donnees.listerApplications(),
        BFS.donnees.listerConnexions()
      ]);
      catalogue  = resultats[0] || [];
      connexions = resultats[1] || [];
      BFS.debug.log('Catalogue :', catalogue.length, '— connectées :', connexions.length);
      dessinerTuiles();
    } catch (err) {
      BFS.debug.erreur('Chargement du tableau de bord impossible :', err.message);
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur', 6000);
    }
  }

  function dessinerTuiles() {
    var grille = $('#grille-tuiles');
    grille.innerHTML = '';

    var actives = connexions.filter(function (c) { return c.applications; });

    $('#etat-vide').hidden = actives.length > 0;
    grille.hidden = actives.length === 0;

    actives.forEach(function (cnx) {
      grille.appendChild(construireTuile(cnx));
    });
  }

  function construireTuile(cnx) {
    var app = cnx.applications;
    var couleur = app.couleur || '#f3ab12';

    var tuile = creer('button', {
      classe: 'tuile',
      attributs: { type: 'button', 'aria-label': 'Ouvrir ' + app.nom },
      style: { '--couleur-app': couleur }
    });

    /* En-tête : icône + nom */
    var icone = creer('div', { classe: 'tuile-icone' });
    if (app.icone_url) {
      icone.appendChild(creer('img', { attributs: { src: app.icone_url, alt: '' } }));
    } else {
      icone.textContent = app.initiales || BFS.core.initiales(app.nom, '', app.nom);
    }

    tuile.appendChild(creer('div', {
      classe: 'tuile-entete',
      enfants: [icone, creer('div', { classe: 'tuile-nom', texte: app.nom })]
    }));

    tuile.appendChild(creer('p', { classe: 'tuile-desc', texte: app.description || '' }));

    /* Pied : dernier accès + étiquettes */
    var etiquettes = creer('div', { classe: 'tuile-etiquettes' });
    if (app.type === 'externe') {
      etiquettes.appendChild(creer('span', { classe: 'etiquette externe', texte: 'Service externe' }));
    }
    if (cnx.statut === 'a_reconnecter') {
      etiquettes.appendChild(creer('span', { classe: 'etiquette alerte', texte: 'À reconnecter' }));
    } else if (app.supporte_jeton && BFS.config.MEMORISATION_JETON) {
      etiquettes.appendChild(creer('span', { classe: 'etiquette jeton', texte: 'Session mémorisée' }));
    }

    tuile.appendChild(creer('div', {
      classe: 'tuile-pied',
      enfants: [
        creer('span', { texte: BFS.core.depuis(cnx.dernier_acces) }),
        etiquettes
      ]
    }));

    /* Bouton retirer */
    var retirer = creer('button', {
      classe: 'btn-retirer', texte: '×',
      attributs: { type: 'button', title: 'Retirer cette brique de mon tableau de bord' }
    });
    retirer.addEventListener('click', function (e) {
      e.stopPropagation();
      demanderRetrait(cnx);
    });
    tuile.appendChild(retirer);

    tuile.addEventListener('click', function () { ouvrir(cnx); });
    return tuile;
  }

  /* ==================================================================
     OUVERTURE D'UNE BRIQUE
     ================================================================== */

  async function ouvrir(cnx) {
    var app = cnx.applications;

    if (!BFS.core.estUrlValide(app.url)) {
      BFS.core.notifier("L'adresse de cette application n'est pas encore renseignée.", 'erreur', 5000);
      return;
    }

    BFS.donnees.toucherAcces(cnx.id);
    BFS.donnees.journaliser('ouverture_brique', app.id, app.nom);
    cnx.dernier_acces = new Date().toISOString();

    var url = app.url;

    /* --- V2 : mémorisation de session -------------------------------
       Quand MEMORISATION_JETON passera à true et que l'application
       cible saura recevoir une session, c'est ici que le jeton sera
       échangé puis ajouté au fragment de l'URL :

         url += '#access_token=' + jeton.access_token +
                '&refresh_token=' + jeton.refresh_token;

       Rien n'est transmis tant que la v2 n'est pas activée.
       ---------------------------------------------------------------- */

    BFS.debug.info('Ouverture de', app.nom, '→', url);

    if (BFS.config.OUVRIR_NOUVEL_ONGLET) {
      /* Ne PAS passer 'noopener' en 3e argument : la plupart des
         navigateurs renvoient alors null même quand l'onglet s'est bien
         ouvert, ce qui déclenchait à tort le repli ci-dessous et faisait
         naviguer l'onglet Univers BFS en plus du nouvel onglet.
         On coupe la référence opener manuellement à la place, ce qui
         donne la même sécurité sans perdre la détection du blocage. */
      var onglet = window.open(url, '_blank');
      if (onglet) {
        onglet.opener = null;
      } else {
        /* Bloqueur de fenêtres, fréquent en PWA installée : on bascule
           sur une navigation classique plutôt que d'échouer en silence. */
        BFS.debug.info('Ouverture en nouvel onglet bloquée, navigation directe.');
        location.href = url;
      }
    } else {
      location.href = url;
    }

    setTimeout(dessinerTuiles, 400);
  }

  /* ==================================================================
     CATALOGUE
     ================================================================== */

  async function afficherCatalogue() {
    BFS.core.montrerPage('page-catalogue');
    var liste = $('#liste-catalogue');
    liste.innerHTML = '<p class="vide-tableau">Chargement…</p>';

    try {
      catalogue  = await BFS.donnees.listerApplications();
      connexions = await BFS.donnees.listerConnexions();
    } catch (err) {
      liste.innerHTML = '<p class="vide-tableau">Chargement impossible.</p>';
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
      return;
    }

    var disponibles = catalogue.filter(function (a) { return a.actif !== false; });

    liste.innerHTML = '';
    if (!disponibles.length) {
      liste.innerHTML = '<p class="vide-tableau">Aucune application au catalogue pour le moment.</p>';
      return;
    }

    disponibles.forEach(function (app) {
      liste.appendChild(construireLigneCatalogue(app));
    });
  }

  function construireLigneCatalogue(app) {
    var deja = connexions.find(function (c) { return c.application_id === app.id; });
    var couleur = app.couleur || '#f3ab12';

    var icone = creer('div', { classe: 'tuile-icone', style: { '--couleur-app': couleur } });
    if (app.icone_url) icone.appendChild(creer('img', { attributs: { src: app.icone_url, alt: '' } }));
    else icone.textContent = app.initiales || BFS.core.initiales(app.nom, '', app.nom);

    var texte = creer('div', {
      classe: 'ligne-catalogue-texte',
      enfants: [
        creer('div', { classe: 'tuile-nom', texte: app.nom }),
        creer('p', { classe: 'tuile-desc', texte: app.description || '' })
      ]
    });

    var ligne = creer('div', {
      classe: 'ligne-catalogue',
      style: { '--couleur-app': couleur },
      enfants: [icone, texte]
    });

    if (deja) {
      ligne.appendChild(creer('span', { classe: 'deja-connecte', texte: '✓ Déjà connectée' }));
    } else {
      var bouton = creer('button', { classe: 'btn btn-principal', texte: 'Connecter' });
      bouton.addEventListener('click', function () { demanderConnexion(app, bouton); });
      ligne.appendChild(bouton);
    }

    return ligne;
  }

  /* ------------------------------------------------------------------
     Connecter une brique
     ------------------------------------------------------------------ */
  function demanderConnexion(app, bouton) {
    var externe = app.type === 'externe';

    var corps =
      '<p>' + BFS.core.echapper(app.nom) + ' va être ajoutée à votre tableau de bord.</p>' +
      (externe
        ? '<p class="aide"><strong>Service externe.</strong> La tuile ouvrira ' +
          BFS.core.echapper(app.nom) + ' dans un nouvel onglet. Vous vous y connecterez ' +
          'avec vos identifiants habituels : le portail ne les conserve pas.</p>'
        : '<p class="aide">Il vous faut un compte sur cette application. Si vous n\'en avez pas, ' +
          'demandez-le à votre administrateur avant de la connecter.</p>') +
      '<label for="cnx-identifiant">Identifiant utilisé sur cette application (facultatif)</label>' +
      '<input type="email" id="cnx-identifiant" placeholder="pour vous en souvenir">' +
      '<p class="aide">Simple pense-bête. Aucun mot de passe n\'est demandé ni enregistré.</p>';

    BFS.core.ouvrirModale('Connecter ' + app.nom, corps, [
      { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
      { libelle: 'Connecter', classe: 'btn-principal', action: async function () {
          var identifiant = ($('#cnx-identifiant').value || '').trim();
          try {
            await BFS.donnees.ajouterConnexion(app.id, identifiant);
            await BFS.donnees.journaliser('ajout_brique', app.id, app.nom);
            BFS.core.fermerModale();
            BFS.core.notifier(app.nom + ' a été ajoutée à votre tableau de bord.', 'succes');
            if (bouton) bouton.replaceWith(creer('span', { classe: 'deja-connecte', texte: '✓ Déjà connectée' }));
            connexions = await BFS.donnees.listerConnexions();
          } catch (err) {
            BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
          }
        }
      }
    ]);
  }

  /* ------------------------------------------------------------------
     Retirer une brique
     ------------------------------------------------------------------ */
  function demanderRetrait(cnx) {
    var app = cnx.applications;
    BFS.core.ouvrirModale(
      'Retirer ' + app.nom + ' ?',
      '<p>Cette brique disparaîtra de votre tableau de bord. ' +
      'Votre compte sur ' + BFS.core.echapper(app.nom) + ' n\'est pas supprimé, ' +
      'et vous pourrez la reconnecter à tout moment.</p>',
      [
        { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
        { libelle: 'Retirer', classe: 'btn-danger', action: async function () {
            try {
              await BFS.donnees.retirerConnexion(cnx.id);
              await BFS.donnees.journaliser('retrait_brique', app.id, app.nom);
              BFS.core.fermerModale();
              BFS.core.notifier(app.nom + ' a été retirée.', 'succes');
              await rafraichirTableauDeBord();
            } catch (err) {
              BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
            }
          }
        }
      ]
    );
  }

  /* ------------------------------------------------------------------ */
  return {
    rafraichirTableauDeBord: rafraichirTableauDeBord,
    afficherCatalogue: afficherCatalogue
  };
})();

BFS.debug.info('applications.js chargé.');
