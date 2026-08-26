/* =====================================================================
   Univers BFS — admin.js
   Écran d'administration : catalogue des briques proposées aux agents,
   et liste des agents BFS.

   Réservé aux profils dont le rôle vaut « admin ». Le masquage du menu
   n'est qu'un confort : la vraie protection est assurée côté base par
   les policies RLS.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.admin = (function () {
  'use strict';

  var $ = BFS.core.$;
  var creer = BFS.core.creer;

  /* Statut super admin de l'agent connecté, mémorisé après chaque
     affichage de l'onglet Agents. Sert à décider si le bouton de
     réinitialisation de mot de passe apparaît sur chaque ligne — la
     vraie protection reste côté serveur (Edge Function). */
  var superAdminActuel = false;

  /* ------------------------------------------------------------------
     Ouverture
     ------------------------------------------------------------------ */
  async function afficher() {
    BFS.core.montrerPage('page-admin');
    await chargerApplications();
  }

  function initOnglets() {
    BFS.core.$$('.onglet-page').forEach(function (o) {
      o.addEventListener('click', async function () {
        var cible = o.dataset.ongletAdmin;
        BFS.core.$$('.onglet-page').forEach(function (x) { x.classList.toggle('actif', x === o); });
        $('#admin-applications').hidden = cible !== 'applications';
        $('#admin-agents').hidden       = cible !== 'agents';
        if (cible === 'agents') await chargerAgents();
        else await chargerApplications();
      });
    });
  }

  /* ==================================================================
     APPLICATIONS
     ================================================================== */

  async function chargerApplications() {
    var zone = $('#tableau-applications');
    zone.innerHTML = '<p class="vide-tableau">Chargement…</p>';
    try {
      var apps = await BFS.donnees.listerApplications();
      zone.innerHTML = '';
      if (!apps.length) {
        zone.innerHTML = '<p class="vide-tableau">Aucune brique au catalogue.</p>';
        return;
      }
      apps.forEach(function (app) { zone.appendChild(ligneApplication(app)); });
    } catch (err) {
      zone.innerHTML = '<p class="vide-tableau">Chargement impossible.</p>';
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
    }
  }

  function ligneApplication(app) {
    var couleur = app.couleur || '#f3ab12';

    var icone = creer('div', { classe: 'tuile-icone', style: { '--couleur-app': couleur } });
    icone.textContent = app.initiales || BFS.core.initiales(app.nom, '', app.nom);

    var sousTitre = [
      app.type === 'externe' ? 'Service externe' : 'Application BFS',
      app.actif === false ? 'MASQUÉE' : null,
      app.url
    ].filter(Boolean).join(' · ');

    var texte = creer('div', {
      classe: 'tableau-ligne-texte',
      enfants: [
        creer('div', { classe: 'tuile-nom', texte: app.nom }),
        creer('p', { classe: 'tuile-desc', texte: sousTitre })
      ]
    });

    var modifier = creer('button', { classe: 'btn-icone', texte: 'Modifier' });
    modifier.addEventListener('click', function () { formulaireApplication(app); });

    var supprimer = creer('button', { classe: 'btn-icone danger', texte: 'Supprimer' });
    supprimer.addEventListener('click', function () { confirmerSuppression(app); });

    return creer('div', {
      classe: 'tableau-ligne',
      enfants: [icone, texte, creer('div', {
        classe: 'tableau-actions', enfants: [modifier, supprimer]
      })]
    });
  }

  /* ------------------------------------------------------------------
     Formulaire d'une brique
     ------------------------------------------------------------------ */
  function formulaireApplication(app) {
    app = app || {};
    var e = BFS.core.echapper;

    var corps =
      '<label for="af-nom">Nom affiché</label>' +
      '<input type="text" id="af-nom" value="' + e(app.nom || '') + '" placeholder="BFS Habelec">' +

      '<label for="af-code">Code interne</label>' +
      '<input type="text" id="af-code" value="' + e(app.code || '') + '" placeholder="bfs-habelec">' +
      '<p class="aide">Identifiant technique, en minuscules et sans espace. Ne se modifie plus ensuite.</p>' +

      '<label for="af-desc">Description</label>' +
      '<input type="text" id="af-desc" value="' + e(app.description || '') + '" placeholder="À quoi sert cette application ?">' +

      '<label for="af-url">Adresse (URL)</label>' +
      '<input type="url" id="af-url" value="' + e(app.url || '') + '" placeholder="https://…">' +

      '<div class="ligne-double">' +
        '<div>' +
          '<label for="af-initiales">Initiales sur la tuile</label>' +
          '<input type="text" id="af-initiales" maxlength="3" value="' + e(app.initiales || '') + '" placeholder="BH">' +
        '</div>' +
        '<div>' +
          '<label for="af-couleur">Couleur</label>' +
          '<select id="af-couleur">' +
            optionCouleur('#f3ab12', 'Jaune BFS', app.couleur) +
            optionCouleur('#b2181a', 'Rouge BFS', app.couleur) +
            optionCouleur('#464645', 'Gris BFS', app.couleur) +
            optionCouleur('#080808', 'Noir BFS', app.couleur) +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="ligne-double">' +
        '<div>' +
          '<label for="af-type">Type</label>' +
          '<select id="af-type">' +
            '<option value="interne"' + (app.type !== 'externe' ? ' selected' : '') + '>Application BFS</option>' +
            '<option value="externe"' + (app.type === 'externe' ? ' selected' : '') + '>Service externe</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label for="af-ordre">Ordre d\'affichage</label>' +
          '<input type="text" id="af-ordre" inputmode="numeric" value="' + e(app.ordre != null ? app.ordre : 100) + '">' +
        '</div>' +
      '</div>' +

      '<label for="af-actif">Visibilité</label>' +
      '<select id="af-actif">' +
        '<option value="oui"' + (app.actif !== false ? ' selected' : '') + '>Proposée aux agents</option>' +
        '<option value="non"' + (app.actif === false ? ' selected' : '') + '>Masquée du catalogue</option>' +
      '</select>';

    BFS.core.ouvrirModale(app.id ? 'Modifier ' + app.nom : 'Nouvelle brique', corps, [
      { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
      { libelle: 'Enregistrer', classe: 'btn-principal', action: function () { enregistrer(app); } }
    ]);

    if (app.id) $('#af-code').disabled = true;
  }

  function optionCouleur(valeur, libelle, courante) {
    var choisie = (courante || '#f3ab12') === valeur;
    return '<option value="' + valeur + '"' + (choisie ? ' selected' : '') + '>' + libelle + '</option>';
  }

  async function enregistrer(app) {
    var charge = {
      id:          app.id || null,
      nom:         $('#af-nom').value.trim(),
      code:        (app.code || $('#af-code').value.trim()).toLowerCase().replace(/\s+/g, '-'),
      description: $('#af-desc').value.trim(),
      url:         $('#af-url').value.trim(),
      initiales:   $('#af-initiales').value.trim().toUpperCase(),
      couleur:     $('#af-couleur').value,
      type:        $('#af-type').value,
      ordre:       parseInt($('#af-ordre').value, 10) || 100,
      actif:       $('#af-actif').value === 'oui'
    };

    if (!charge.nom)  { BFS.core.notifier('Le nom est obligatoire.', 'erreur'); return; }
    if (!charge.code) { BFS.core.notifier('Le code interne est obligatoire.', 'erreur'); return; }
    if (!BFS.core.estUrlValide(charge.url)) {
      BFS.core.notifier("L'adresse doit commencer par https://", 'erreur'); return;
    }

    try {
      await BFS.donnees.enregistrerApplication(charge);
      BFS.core.fermerModale();
      BFS.core.notifier('Brique enregistrée.', 'succes');
      await chargerApplications();
    } catch (err) {
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
    }
  }

  function confirmerSuppression(app) {
    BFS.core.ouvrirModale(
      'Supprimer ' + app.nom + ' ?',
      '<p>Cette brique disparaîtra du catalogue <strong>et des tableaux de bord ' +
      'de tous les agents</strong> qui l\'avaient connectée.</p>' +
      '<p class="aide">Pour la retirer temporairement, préférez la passer en ' +
      '« masquée du catalogue » : les agents qui l\'utilisent la conservent.</p>',
      [
        { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
        { libelle: 'Supprimer définitivement', classe: 'btn-danger', action: async function () {
            try {
              await BFS.donnees.supprimerApplication(app.id);
              BFS.core.fermerModale();
              BFS.core.notifier('Brique supprimée.', 'succes');
              await chargerApplications();
            } catch (err) {
              BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
            }
          }
        }
      ]
    );
  }

  /* ==================================================================
     AGENTS
     ================================================================== */

  async function chargerAgents() {
    var zone = $('#tableau-agents');
    zone.innerHTML = '<p class="vide-tableau">Chargement…</p>';
    afficherBoutonProvisionnement();
    try {
      var agents = await BFS.donnees.listerAgents();
      zone.innerHTML = '';
      if (!agents.length) {
        zone.innerHTML = '<p class="vide-tableau">Aucun agent enregistré.</p>';
        return;
      }
      agents.forEach(function (a) { zone.appendChild(ligneAgent(a)); });
    } catch (err) {
      zone.innerHTML = '<p class="vide-tableau">Chargement impossible. ' +
        'Vérifiez que votre profil a bien le rôle « admin ».</p>';
      BFS.debug.erreur('Chargement des agents :', err.message);
    }
  }

  /* Le bouton « Provisionner un compte » n'a de sens que pour le super
     admin (accès de secours, pas un rôle du quotidien — voir MEMOIRE_PROJET).
     Ce contrôle est un confort d'affichage : la vraie protection est dans
     l'Edge Function, qui revérifie est_super_admin() côté serveur. */
  async function afficherBoutonProvisionnement() {
    var bouton = $('#btn-provisionner-compte');
    try {
      superAdminActuel = await BFS.donnees.estSuperAdmin();
    } catch (err) {
      superAdminActuel = false;
      BFS.debug.erreur('Vérification super admin impossible :', err.message);
    }
    if (bouton) bouton.hidden = !superAdminActuel;
  }

  /* ------------------------------------------------------------------
     Provisionnement d'un compte (super admin uniquement)
     ------------------------------------------------------------------ */
  function provisionnerCompte() {
    var corps =
      '<p class="aide">Comptes existants (auth.users est partagé entre ' +
      'toutes les briques — inutile de recréer un compte déjà listé ici, ' +
      'demande simplement à la brique concernée de le rattacher).</p>' +
      '<div id="pc-liste-comptes" class="tableau tableau-compact">' +
        '<p class="vide-tableau">Chargement…</p>' +
      '</div>' +
      '<label for="pc-email" style="margin-top:1rem">E-mail du nouvel agent</label>' +
      '<input type="email" id="pc-email" placeholder="prenom.nom@bfs.fr" autocomplete="off">' +
      '<p class="aide">Crée uniquement le compte de connexion (mot de passe ' +
      'initial commun, à changer par l\'agent). Aucune brique ne lui est ' +
      'ouverte automatiquement — chaque brique doit ensuite le rattacher ' +
      'chez elle via sa propre pré-inscription.</p>';

    BFS.core.ouvrirModale('Provisionner un compte', corps, [
      { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
      { libelle: 'Créer le compte', classe: 'btn-principal', action: soumettreProvisionnement }
    ]);

    chargerComptesExistants();
  }

  async function chargerComptesExistants() {
    var zone = $('#pc-liste-comptes');
    if (!zone) return;
    try {
      var comptes = await BFS.donnees.listerComptesAuth();
      if (!zone.isConnected) return; /* modale fermée entre-temps */
      if (!comptes.length) {
        zone.innerHTML = '<p class="vide-tableau">Aucun compte pour l\'instant.</p>';
        return;
      }
      zone.innerHTML = '';
      var liste = creer('div', { classe: 'liste-comptes-existants' });
      comptes.forEach(function (c) {
        var ligne = creer('div', {
          classe: 'tableau-ligne tableau-ligne-compacte',
          enfants: [
            creer('span', { classe: 'tuile-nom', texte: c.email || '(sans e-mail)' }),
            creer('span', {
              classe: 'texte-discret',
              texte: c.confirme ? 'confirmé' : 'en attente de confirmation'
            })
          ]
        });
        liste.appendChild(ligne);
      });
      zone.appendChild(liste);
    } catch (err) {
      if (!zone.isConnected) return;
      zone.innerHTML = '<p class="vide-tableau">Liste indisponible.</p>';
      BFS.debug.erreur('Chargement des comptes existants :', err.message);
    }
  }

  async function soumettreProvisionnement() {
    var champ = $('#pc-email');
    var email = (champ.value || '').trim().toLowerCase();

    if (!email || email.indexOf('@') === -1) {
      BFS.core.notifier('Adresse e-mail invalide.', 'erreur');
      return;
    }

    try {
      var resultat = await BFS.donnees.provisionnerCompte(email);
      BFS.core.fermerModale();
      BFS.core.notifier('Compte créé pour ' + resultat.email + '.', 'succes');
    } catch (err) {
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
    }
  }

  function ligneAgent(agent) {
    var nomComplet = [agent.prenom, agent.nom].filter(Boolean).join(' ') || agent.email;

    var avatar = creer('div', { classe: 'tuile-icone', style: { '--couleur-app': '#464645' } });
    avatar.textContent = BFS.core.initiales(agent.prenom, agent.nom, agent.email);

    var sousTitre = [
      agent.email,
      agent.fonction,
      agent.agence,
      agent.role === 'admin' ? 'ADMINISTRATEUR' : null,
      agent.actif === false ? 'DÉSACTIVÉ' : null
    ].filter(Boolean).join(' · ');

    var texte = creer('div', {
      classe: 'tableau-ligne-texte',
      enfants: [
        creer('div', { classe: 'tuile-nom', texte: nomComplet }),
        creer('p', { classe: 'tuile-desc', texte: sousTitre })
      ]
    });

    var basculeRole = creer('button', {
      classe: 'btn-icone',
      texte: agent.role === 'admin' ? 'Retirer admin' : 'Passer admin'
    });
    basculeRole.addEventListener('click', async function () {
      try {
        await BFS.donnees.majAgent(agent.id, { role: agent.role === 'admin' ? 'agent' : 'admin' });
        BFS.core.notifier('Rôle modifié.', 'succes');
        await chargerAgents();
      } catch (err) { BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur'); }
    });

    var basculeActif = creer('button', {
      classe: 'btn-icone' + (agent.actif === false ? '' : ' danger'),
      texte: agent.actif === false ? 'Réactiver' : 'Désactiver'
    });
    basculeActif.addEventListener('click', async function () {
      try {
        await BFS.donnees.majAgent(agent.id, { actif: agent.actif === false });
        BFS.core.notifier('Agent mis à jour.', 'succes');
        await chargerAgents();
      } catch (err) { BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur'); }
    });

    var actions = [basculeRole, basculeActif];

    if (superAdminActuel) {
      var reinitMdp = creer('button', { classe: 'btn-icone', texte: 'Réinitialiser mot de passe' });
      reinitMdp.addEventListener('click', function () { confirmerReinitMdp(agent, nomComplet); });
      actions.push(reinitMdp);
    }

    return creer('div', {
      classe: 'tableau-ligne',
      enfants: [avatar, texte, creer('div', {
        classe: 'tableau-actions', enfants: actions
      })]
    });
  }

  /* Réservé au super admin (voir superAdminActuel plus haut). Remet le
     mot de passe du compte sur le mot de passe initial commun — celui
     utilisé par provisionner-compte — via l'Edge Function dédiée, qui
     revérifie est_super_admin() côté serveur. */
  function confirmerReinitMdp(agent, nomComplet) {
    BFS.core.ouvrirModale(
      'Réinitialiser le mot de passe ?',
      '<p>Le mot de passe de <strong>' + BFS.core.echapper(nomComplet) +
      '</strong> sera remis sur le mot de passe initial commun. ' +
      "L'agent devra le changer à sa prochaine connexion.</p>",
      [
        { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
        { libelle: 'Réinitialiser', classe: 'btn-danger', action: async function () {
            try {
              await BFS.donnees.reinitialiserMotDePasse(agent.id);
              BFS.core.fermerModale();
              BFS.core.notifier('Mot de passe réinitialisé.', 'succes');
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
    afficher: afficher,
    initOnglets: initOnglets,
    nouvelleApplication: function () { formulaireApplication(null); },
    provisionnerCompte: provisionnerCompte
  };
})();

BFS.debug.info('admin.js chargé.');
