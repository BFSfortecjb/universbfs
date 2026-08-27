/* =====================================================================
   Univers BFS — donnees.js
   Couche d'accès aux données. Tout le reste du portail passe par
   BFS.donnees et ignore complètement s'il parle à Supabase ou au jeu
   de démonstration.

   C'est ici — et uniquement ici — que se brancheront les jetons de
   reconnexion en v2 (voir les fonctions marquées « V2 »).
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.donnees = (function () {
  'use strict';

  /* Si la base n'est pas configurée, on renvoie l'API de démonstration. */
  if (BFS.config.MODE_DEMO) {
    BFS.debug.info('donnees.js : couche de DÉMONSTRATION active.');
    return BFS.demo.api;
  }

  function sb() {
    var c = BFS.core.client;
    if (!c) throw new Error("Le portail n'est pas connecté à sa base.");
    return c;
  }

  function verifier(reponse) {
    if (reponse.error) throw reponse.error;
    return reponse.data;
  }

  async function utilisateurCourant() {
    var r = await sb().auth.getUser();
    if (r.error) throw r.error;
    return r.data.user;
  }

  var api = {

    /* ================= AUTHENTIFICATION ================= */

    sessionActuelle: async function () {
      var r = await sb().auth.getSession();
      if (r.error) throw r.error;
      return r.data.session;
    },

    connexion: async function (email, motDePasse) {
      var r = await sb().auth.signInWithPassword({ email: email, password: motDePasse });
      if (r.error) throw r.error;
      return { utilisateur: r.data.user };
    },

    inscription: async function (email, motDePasse, prenom, nom) {
      var r = await sb().auth.signUp({
        email: email,
        password: motDePasse,
        options: { data: { prenom: prenom, nom: nom } }
      });
      if (r.error) throw r.error;
      return {
        utilisateur: r.data.user,
        confirmationRequise: !r.data.session
      };
    },

    deconnexion: async function () {
      var r = await sb().auth.signOut();
      if (r.error) throw r.error;
      return true;
    },

    reinitialiserMdp: async function (email) {
      var r = await sb().auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      if (r.error) throw r.error;
      return true;
    },

    changerMdp: async function (nouveau) {
      var r = await sb().auth.updateUser({ password: nouveau });
      if (r.error) throw r.error;
      return true;
    },

    /* ================= PROFIL ================= */

    chargerProfil: async function () {
      var u = await utilisateurCourant();
      if (!u) return null;
      var data = verifier(
        await sb().from('profils').select('*').eq('id', u.id).maybeSingle()
      );
      /* Filet de sécurité si le trigger de création n'a pas tourné. */
      if (!data) {
        BFS.debug.info('Profil absent, création à la volée.');
        data = verifier(
          await sb().from('profils')
            .insert({ id: u.id, email: u.email })
            .select().single()
        );
      }
      return data;
    },

    majProfil: async function (champs) {
      var u = await utilisateurCourant();
      return verifier(
        await sb().from('profils').update(champs).eq('id', u.id).select().single()
      );
    },

    /* ================= APPLICATIONS ================= */

    listerApplications: async function () {
      return verifier(
        await sb().from('applications').select('*').order('ordre', { ascending: true })
      );
    },

    enregistrerApplication: async function (app) {
      var charge = {
        code: app.code, nom: app.nom, description: app.description,
        url: app.url, couleur: app.couleur, initiales: app.initiales,
        type: app.type, ordre: app.ordre, actif: app.actif !== false
      };
      if (app.id) {
        return verifier(await sb().from('applications').update(charge).eq('id', app.id).select());
      }
      return verifier(await sb().from('applications').insert(charge).select());
    },

    supprimerApplication: async function (appId) {
      verifier(await sb().from('applications').delete().eq('id', appId));
      return true;
    },

    /* ================= CONNEXIONS DE L'AGENT ================= */

    listerConnexions: async function () {
      var u = await utilisateurCourant();
      return verifier(
        await sb().from('connexions_app')
          .select('*, applications(*)')
          .eq('user_id', u.id)
          .order('ordre', { ascending: true })
      );
    },

    ajouterConnexion: async function (appId, identifiant) {
      var u = await utilisateurCourant();
      return verifier(
        await sb().from('connexions_app').insert({
          user_id: u.id,
          application_id: appId,
          identifiant_distant: identifiant || null
        }).select()
      );
    },

    retirerConnexion: async function (cnxId) {
      verifier(await sb().from('connexions_app').delete().eq('id', cnxId));
      return true;
    },

    toucherAcces: async function (cnxId) {
      try {
        await sb().from('connexions_app')
          .update({ dernier_acces: new Date().toISOString() })
          .eq('id', cnxId);
      } catch (e) {
        BFS.debug.erreur('Horodatage du dernier accès impossible :', e.message);
      }
      return true;
    },

    /* ================= ADMINISTRATION ================= */

    listerAgents: async function () {
      return verifier(
        await sb().from('profils').select('*').order('nom', { ascending: true })
      );
    },

    majAgent: async function (agentId, champs) {
      return verifier(
        await sb().from('profils').update(champs).eq('id', agentId).select()
      );
    },

    /* Statut super admin de l'agent connecté — la fonction lit auth.uid()
       en interne, aucun paramètre à lui passer.
       Elle vit dans le schéma public (colle BFS commune, hors briques),
       alors que le client du portail est configuré par défaut sur le
       schéma portail (PO_config.js) — on force donc explicitement le
       schéma public pour cet appel précis, sinon PostgREST cherche
       portail.est_super_admin() et échoue avec « Could not find the
       function ... in the schema cache ». */
    estSuperAdmin: async function () {
      var r = await sb().schema('public').rpc('est_super_admin');
      if (r.error) throw r.error;
      return r.data === true;
    },

    /* Provisionne un compte auth.users brut via l'Edge Function dédiée.
       Réservé au super admin — la fonction elle-même revérifie ce statut
       côté serveur, ce contrôle client n'est qu'un confort d'affichage.
       N'écrit rien dans aucune brique : chaque brique reste responsable
       de rattacher ce compte chez elle. */
    /* Lecture seule des comptes auth.users existants (id, email, date de
       création, confirmé). Réservé au super admin — utile pour vérifier
       si un agent a déjà un compte avant de tenter d'en provisionner un
       (auth.users étant partagé entre toutes les briques, un compte créé
       ailleurs existe déjà ici). */
    listerComptesAuth: async function () {
      var r = await sb().functions.invoke('lister-comptes', { method: 'GET' });
      if (r.error) {
        var messageServeur = null;
        try {
          if (r.error.context && typeof r.error.context.json === 'function') {
            var corps = await r.error.context.json();
            messageServeur = corps && corps.error;
          }
        } catch (e) { /* pas grave, on retombe sur le message générique */ }
        throw new Error(messageServeur || r.error.message);
      }
      return (r.data && r.data.comptes) || [];
    },

    provisionnerCompte: async function (email) {
      var r = await sb().functions.invoke('provisionner-compte', {
        body: { email: email }
      });
      if (r.error) {
        /* Le SDK Supabase n'expose pas toujours le corps JSON de l'erreur
           renvoyée par la fonction — on tente de le récupérer pour avoir
           le vrai message (403, 409...) plutôt qu'une erreur générique. */
        var messageServeur = null;
        try {
          if (r.error.context && typeof r.error.context.json === 'function') {
            var corps = await r.error.context.json();
            messageServeur = corps && corps.error;
          }
        } catch (e) { /* pas grave, on retombe sur le message générique */ }
        throw new Error(messageServeur || r.error.message);
      }
      return r.data;
    },

    /* Réinitialise le mot de passe d'un compte existant sur le mot de
       passe initial commun (Edge Function dédiée, même secret que
       provisionner-compte). Réservé au super admin — revérifié côté
       serveur. Prend l'id auth.users de l'agent (= profils.id). */
    reinitialiserMotDePasse: async function (agentId) {
      var r = await sb().functions.invoke('reinitialiser-mot-de-passe', {
        body: { id: agentId }
      });
      if (r.error) {
        var messageServeur = null;
        try {
          if (r.error.context && typeof r.error.context.json === 'function') {
            var corps = await r.error.context.json();
            messageServeur = corps && corps.error;
          }
        } catch (e) { /* pas grave, on retombe sur le message générique */ }
        throw new Error(messageServeur || r.error.message);
      }
      return r.data;
    },

    /* ================= JOURNAL ================= */

    journaliser: async function (action, appId, detail) {
      try {
        var u = await utilisateurCourant();
        if (!u) return true;
        await sb().from('journal_acces').insert({
          user_id: u.id,
          application_id: appId || null,
          action: action,
          detail: detail || null
        });
      } catch (e) {
        /* Le journal ne doit jamais bloquer l'utilisateur. */
        BFS.debug.erreur('Écriture du journal impossible :', e.message);
      }
      return true;
    }

    /* ================= V2 — MÉMORISATION PAR JETON =================
       À implémenter quand BFS Contrôle et BFS Habelec auront reçu le
       bloc de réception de session. Les colonnes jeton_chiffre et
       jeton_expire_le de connexions_app sont déjà prévues, et la
       policy RLS garantit qu'un agent ne lit que ses propres jetons.

       enregistrerJeton: async function (cnxId, jeton, expireLe) { ... }
       recupererJeton:   async function (cnxId) { ... }
       ============================================================== */
  };

  BFS.debug.info('donnees.js : couche SUPABASE active.');
  return api;
})();
