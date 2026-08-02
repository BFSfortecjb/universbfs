/* =====================================================================
   Univers BFS — config.js
   SEUL FICHIER À MODIFIER pour raccorder le portail à votre base.

   Marche à suivre :
     1. Créer un projet sur https://supabase.com (gratuit).
     2. Dans le projet : Settings → API.
     3. Recopier « Project URL » et la clé « anon public » ci-dessous.

   La clé « anon public » est faite pour être publique : elle ne donne
   accès à rien sans compte, la sécurité étant assurée par les règles
   RLS installées par le fichier SQL. Ne JAMAIS mettre ici la clé
   « service_role ».

   Tant que ces deux valeurs restent vides, le portail démarre en
   MODE DÉMONSTRATION avec des données fictives.
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.config = {

  /* --- Connexion Supabase ------------------------------------------ */
  SUPABASE_URL:      'https://dqraobwozowtnrieitkp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_UhkImOyooXPnAqTCNMJ4wA_VVqscCmK',
  SUPABASE_SCHEMA:   'portail',   // projet commun BFS : les tables du portail vivent dans ce schéma

  /* --- Identité du portail ----------------------------------------- */
  NOM_PORTAIL: 'Univers BFS',

  /* --- Comportement ------------------------------------------------- */

  /* Ouvre les briques dans un nouvel onglet plutôt que dans la fenêtre
     du portail. Recommandé sur ordinateur, à tester sur mobile installé. */
  OUVRIR_NOUVEL_ONGLET: true,

  /* V2 — mémorisation de session par jeton. Reste à false tant que
     BFS Contrôle et BFS Habelec n'ont pas reçu le bloc de code
     correspondant. La base est déjà prête à l'accueillir. */
  MEMORISATION_JETON: false,

  /* Version affichée dans le profil, utile pour le support. */
  VERSION: '1.0.0'
};

/* Le mode démonstration s'active tout seul si la base n'est pas encore
   renseignée. Il permet de montrer le portail sans rien installer. */
BFS.config.MODE_DEMO = !BFS.config.SUPABASE_URL || !BFS.config.SUPABASE_ANON_KEY;

BFS.debug.info('config.js chargé — mode :', BFS.config.MODE_DEMO ? 'DÉMONSTRATION' : 'production');
