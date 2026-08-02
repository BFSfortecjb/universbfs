/* =====================================================================
   Univers BFS — auth.js
   Écran de connexion : connexion, création de compte, mot de passe
   oublié, changement de mot de passe, déconnexion.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.auth = (function () {
  'use strict';

  var $ = BFS.core.$;
  var profilCourant = null;

  /* ------------------------------------------------------------------
     Écran de connexion
     ------------------------------------------------------------------ */
  function initEcran() {
    /* Onglets connexion / inscription */
    BFS.core.$$('.onglet-auth').forEach(function (o) {
      o.addEventListener('click', function () {
        var cible = o.dataset.onglet;
        BFS.core.$$('.onglet-auth').forEach(function (x) {
          x.classList.toggle('actif', x === o);
        });
        $('#form-connexion').hidden   = cible !== 'connexion';
        $('#form-inscription').hidden = cible !== 'inscription';
        BFS.core.message('#message-auth', '');
      });
    });

    /* Afficher / masquer les mots de passe */
    BFS.core.$$('.btn-oeil').forEach(function (b) {
      b.addEventListener('click', function () {
        var champ = document.getElementById(b.dataset.cible);
        if (!champ) return;
        var visible = champ.type === 'text';
        champ.type = visible ? 'password' : 'text';
        b.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
      });
    });

    $('#form-connexion').addEventListener('submit', surConnexion);
    $('#form-inscription').addEventListener('submit', surInscription);

    document.addEventListener('click', function (e) {
      var action = e.target.dataset && e.target.dataset.action;
      if (action === 'mdp-oublie')  { e.preventDefault(); motDePasseOublie(); }
      if (action === 'demo-entrer') { e.preventDefault(); entrerEnDemo(); }
      if (action === 'deconnexion') { e.preventDefault(); deconnexion(); }
      if (action === 'changer-mdp') { e.preventDefault(); changerMotDePasse(); }
    });

    if (BFS.config.MODE_DEMO) $('#bandeau-demo').hidden = false;
  }

  /* ------------------------------------------------------------------
     Connexion
     ------------------------------------------------------------------ */
  async function surConnexion(e) {
    e.preventDefault();
    var bouton = e.target.querySelector('button[type=submit]');
    var email  = $('#conn-email').value.trim();
    var mdp    = $('#conn-mdp').value;

    if (BFS.config.MODE_DEMO) { entrerEnDemo(); return; }

    bouton.disabled = true;
    bouton.textContent = 'Connexion…';
    BFS.core.message('#message-auth', '');

    try {
      await BFS.donnees.connexion(email, mdp);
      BFS.debug.info('Connexion réussie.');
      await BFS.donnees.journaliser('connexion_portail');
      await demarrerSession();
    } catch (err) {
      BFS.debug.erreur('Échec de connexion :', err.message);
      BFS.core.message('#message-auth', BFS.core.traduireErreur(err), 'erreur');
    } finally {
      bouton.disabled = false;
      bouton.textContent = 'Se connecter';
    }
  }

  /* ------------------------------------------------------------------
     Création de compte
     ------------------------------------------------------------------ */
  async function surInscription(e) {
    e.preventDefault();
    var bouton = e.target.querySelector('button[type=submit]');
    var prenom = $('#insc-prenom').value.trim();
    var nom    = $('#insc-nom').value.trim();
    var email  = $('#insc-email').value.trim();
    var mdp    = $('#insc-mdp').value;

    if (mdp.length < 8) {
      BFS.core.message('#message-auth', 'Le mot de passe doit contenir au moins 8 caractères.', 'erreur');
      return;
    }

    bouton.disabled = true;
    bouton.textContent = 'Création…';
    BFS.core.message('#message-auth', '');

    try {
      var res = await BFS.donnees.inscription(email, mdp, prenom, nom);
      if (res.confirmationRequise) {
        BFS.core.message('#message-auth',
          "Compte créé. Un e-mail de confirmation vient de vous être envoyé : " +
          "cliquez sur le lien qu'il contient, puis revenez vous connecter.", 'succes');
        BFS.core.$$('.onglet-auth')[0].click();
      } else {
        await demarrerSession();
      }
    } catch (err) {
      BFS.debug.erreur('Échec de création de compte :', err.message);
      BFS.core.message('#message-auth', BFS.core.traduireErreur(err), 'erreur');
    } finally {
      bouton.disabled = false;
      bouton.textContent = 'Créer mon compte';
    }
  }

  /* ------------------------------------------------------------------
     Mot de passe oublié
     ------------------------------------------------------------------ */
  function motDePasseOublie() {
    var email = $('#conn-email').value.trim();
    BFS.core.ouvrirModale(
      'Mot de passe oublié',
      '<p>Indiquez votre adresse e-mail : vous recevrez un lien pour choisir ' +
      'un nouveau mot de passe.</p>' +
      '<label for="mdp-email">Adresse e-mail</label>' +
      '<input type="email" id="mdp-email" value="' + BFS.core.echapper(email) + '">',
      [
        { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
        { libelle: 'Envoyer le lien', classe: 'btn-principal', action: async function () {
            var adresse = $('#mdp-email').value.trim();
            if (!adresse) return;
            try {
              await BFS.donnees.reinitialiserMdp(adresse);
              BFS.core.fermerModale();
              BFS.core.message('#message-auth',
                "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.", 'succes');
            } catch (err) {
              BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
            }
          }
        }
      ]
    );
  }

  /* ------------------------------------------------------------------
     Changement de mot de passe (depuis le profil)
     ------------------------------------------------------------------ */
  function changerMotDePasse() {
    BFS.core.ouvrirModale(
      'Changer mon mot de passe',
      '<p>Ce mot de passe ouvre l\'accès à toutes vos briques BFS. ' +
      'Choisissez-en un que vous n\'utilisez nulle part ailleurs.</p>' +
      '<label for="nouveau-mdp">Nouveau mot de passe</label>' +
      '<input type="password" id="nouveau-mdp" minlength="8" autocomplete="new-password">' +
      '<label for="confirme-mdp">Confirmation</label>' +
      '<input type="password" id="confirme-mdp" minlength="8" autocomplete="new-password">',
      [
        { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
        { libelle: 'Enregistrer', classe: 'btn-principal', action: async function () {
            var a = $('#nouveau-mdp').value, b = $('#confirme-mdp').value;
            if (a.length < 8)  { BFS.core.notifier('8 caractères minimum.', 'erreur'); return; }
            if (a !== b)       { BFS.core.notifier('Les deux mots de passe diffèrent.', 'erreur'); return; }
            try {
              await BFS.donnees.changerMdp(a);
              BFS.core.fermerModale();
              BFS.core.notifier('Mot de passe modifié.', 'succes');
            } catch (err) {
              BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
            }
          }
        }
      ]
    );
  }

  /* ------------------------------------------------------------------
     Démarrage / arrêt de session
     ------------------------------------------------------------------ */
  async function demarrerSession() {
    profilCourant = await BFS.donnees.chargerProfil();
    BFS.debug.info('Profil chargé :', profilCourant && profilCourant.email);

    peuplerEntete();
    BFS.core.montrerVue('vue-app');
    BFS.core.montrerPage('page-dashboard');
    await BFS.applications.rafraichirTableauDeBord();
  }

  function peuplerEntete() {
    if (!profilCourant) return;
    var p = profilCourant;
    var nomComplet = [p.prenom, p.nom].filter(Boolean).join(' ') || p.email;

    $('#initiales-agent').textContent = BFS.core.initiales(p.prenom, p.nom, p.email);
    $('#prenom-agent').textContent    = p.prenom || nomComplet;
    $('#menu-nom').textContent        = nomComplet;
    $('#menu-email').textContent      = p.email;
    $('#btn-menu-admin').hidden       = p.role !== 'admin';

    $('#profil-prenom').value   = p.prenom || '';
    $('#profil-nom').value      = p.nom || '';
    $('#profil-fonction').value = p.fonction || '';
    $('#profil-agence').value   = p.agence || '';
    $('#profil-email').value    = p.email || '';
  }

  async function deconnexion() {
    try { await BFS.donnees.deconnexion(); } catch (e) { /* on sort quand même */ }
    profilCourant = null;
    location.reload();
  }

  function entrerEnDemo() {
    BFS.debug.info('Entrée en mode démonstration.');
    demarrerSession();
  }

  /* ------------------------------------------------------------------
     Enregistrement du profil
     ------------------------------------------------------------------ */
  function initFormulaireProfil() {
    $('#form-profil').addEventListener('submit', async function (e) {
      e.preventDefault();
      var bouton = e.target.querySelector('button[type=submit]');
      bouton.disabled = true;
      try {
        profilCourant = await BFS.donnees.majProfil({
          prenom:   $('#profil-prenom').value.trim(),
          nom:      $('#profil-nom').value.trim(),
          fonction: $('#profil-fonction').value.trim(),
          agence:   $('#profil-agence').value.trim()
        });
        peuplerEntete();
        BFS.core.notifier('Profil enregistré.', 'succes');
      } catch (err) {
        BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
      } finally {
        bouton.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  return {
    initEcran: initEcran,
    initFormulaireProfil: initFormulaireProfil,
    demarrerSession: demarrerSession,
    deconnexion: deconnexion,
    get profil() { return profilCourant; }
  };
})();

BFS.debug.info('auth.js chargé.');
