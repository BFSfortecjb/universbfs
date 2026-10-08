/* =====================================================================
   Univers BFS — faq.js
   Foire aux questions : réponses rapides aux situations courantes
   (stagiaire absent, incident, réclamation…). Répond à l'exigence de
   gestion des aléas du référentiel Qualiopi.

   Lecture : tout agent connecté au portail.
   Rédaction : administrateurs et super admin (la vraie protection est
   assurée par les règles d'accès RLS de portail.faq_articles ; le
   masquage des boutons n'est qu'un confort).
   ===================================================================== */

window.BFS = window.BFS || {};

BFS.faq = (function () {
  'use strict';

  var $ = BFS.core.$;
  var creer = BFS.core.creer;
  var echapper = BFS.core.echapper;

  var peutRediger = false;
  var articles = [];
  var minuteur = null;
  var initialise = false;

  function client() { return BFS.core.client; }

  /* ------------------------------------------------------------------
     Accès aux données
     ------------------------------------------------------------------ */
  async function rechercherArticles(texte) {
    if (!client()) throw new Error('La FAQ n\'est pas disponible en mode démonstration.');
    var r = await client().rpc('faq_rechercher', { p_q: texte || '' });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function enregistrer(article) {
    var champs = {
      titre: article.titre,
      reponse: article.reponse,
      mots_cles: article.mots_cles,
      categorie: article.categorie || null,
      publie: article.publie,
      relecture_le: article.relecture_le || null
    };
    var r;
    if (article.id) {
      champs.version = (article.version || 1) + 1;
      r = await client().from('faq_articles').update(champs).eq('id', article.id);
    } else {
      r = await client().from('faq_articles').insert(champs);
    }
    if (r.error) throw r.error;
  }

  async function supprimer(id) {
    var r = await client().from('faq_articles').delete().eq('id', id);
    if (r.error) throw r.error;
  }

  /* ------------------------------------------------------------------
     Affichage de la page
     ------------------------------------------------------------------ */
  async function afficher(requete) {
    BFS.core.montrerPage('page-faq');
    brancherEvenements();

    var profil = BFS.auth && BFS.auth.profil;
    peutRediger = !!(profil && profil.role === 'admin');
    if (!peutRediger && BFS.donnees && BFS.donnees.estSuperAdmin) {
      try { peutRediger = await BFS.donnees.estSuperAdmin(); } catch (e) { peutRediger = false; }
    }
    $('#btn-nouvel-article').hidden = !peutRediger;

    $('#faq-recherche').value = requete || '';
    await charger();
    if (!requete) $('#faq-recherche').focus();
  }

  function brancherEvenements() {
    if (initialise) return;
    initialise = true;
    $('#faq-recherche').addEventListener('input', function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(charger, 220);
    });
  }

  /* Le formulaire de recherche du tableau de bord doit fonctionner dès le
     démarrage, avant le premier affichage de la FAQ. */
  function initTableauDeBord() {
    var f = $('#form-faq-dashboard');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      afficher($('#faq-dashboard-recherche').value.trim());
      $('#faq-dashboard-recherche').value = '';
    });
  }

  async function charger() {
    var zone = $('#faq-liste');
    var texte = $('#faq-recherche').value.trim();
    zone.innerHTML = '<p class="vide-tableau">Recherche…</p>';
    try {
      articles = await rechercherArticles(texte);
    } catch (err) {
      zone.innerHTML = '<p class="vide-tableau">Chargement impossible.</p>';
      BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
      return;
    }
    $('#faq-compteur').textContent = articles.length === 0 ? '' :
      articles.length + (articles.length > 1 ? ' articles' : ' article');
    zone.innerHTML = '';

    if (!articles.length) {
      zone.innerHTML = '<div class="etat-vide"><h2>Aucun résultat</h2><p>' +
        (texte ? 'Essayez un autre mot (ex : « absence », « matériel », « réclamation »).'
               : 'La FAQ est vide pour le moment.' +
                 (peutRediger ? ' Ajoutez le premier article avec le bouton « Nouvel article ».' : '')) +
        '</p></div>';
      return;
    }

    var categorieCourante = null;
    articles.forEach(function (a) {
      var cat = a.categorie || 'Autres';
      if (!texte && cat !== categorieCourante) {
        zone.appendChild(creer('h2', { classe: 'faq-categorie', texte: cat }));
        categorieCourante = cat;
      }
      zone.appendChild(carteArticle(a));
    });
  }

  function carteArticle(a) {
    var extrait = (a.reponse || '').replace(/\s+/g, ' ').trim();
    if (extrait.length > 150) extrait = extrait.substring(0, 150).trim() + '…';

    var carte = creer('button', { classe: 'faq-carte', attributs: { type: 'button' } });
    carte.appendChild(creer('span', { classe: 'faq-carte-titre',
      texte: a.titre + (a.publie ? '' : ' (brouillon)') }));
    carte.appendChild(creer('span', { classe: 'faq-carte-extrait', texte: extrait }));
    if (a.mots_cles && a.mots_cles.length) {
      var tags = creer('span', { classe: 'faq-tags' });
      a.mots_cles.slice(0, 6).forEach(function (m) {
        tags.appendChild(creer('span', { classe: 'faq-tag', texte: m }));
      });
      carte.appendChild(tags);
    }
    carte.addEventListener('click', function () { ouvrirArticle(a); });
    return carte;
  }

  /* ------------------------------------------------------------------
     Lecture d'un article
     ------------------------------------------------------------------ */
  function ouvrirArticle(a) {
    var corps =
      '<div class="faq-lecture">' + echapper(a.reponse) + '</div>' +
      (a.mots_cles && a.mots_cles.length
        ? '<p class="faq-meta">Mots-clés : ' + a.mots_cles.map(echapper).join(', ') + '</p>' : '') +
      '<p class="faq-meta">' +
        (a.categorie ? echapper(a.categorie) + ' · ' : '') +
        'version ' + a.version + ' · mis à jour le ' + BFS.core.dateCourte(a.maj_le) +
        (a.relecture_le ? ' · à relire le ' + BFS.core.dateCourte(a.relecture_le) : '') +
      '</p>';

    var boutons = [];
    if (peutRediger) {
      boutons.push({ libelle: 'Supprimer', classe: 'btn-danger', action: function () { confirmerSuppression(a); } });
      boutons.push({ libelle: 'Modifier', classe: 'btn-secondaire', action: function () { formulaire(a); } });
    }
    boutons.push({ libelle: 'Fermer', classe: 'btn-principal', action: BFS.core.fermerModale });
    BFS.core.ouvrirModale(a.titre, corps, boutons);
  }

  /* ------------------------------------------------------------------
     Rédaction (administrateurs)
     ------------------------------------------------------------------ */
  function formulaire(a) {
    a = a || {};
    var corps =
      '<label for="faq-f-titre">Titre (la question)</label>' +
      '<input type="text" id="faq-f-titre" maxlength="200" placeholder="Ex : Mon stagiaire doit s\'absenter (événement familial)" value="' + echapper(a.titre || '') + '">' +
      '<label for="faq-f-reponse">Réponse / procédure</label>' +
      '<textarea id="faq-f-reponse" rows="8" placeholder="Les étapes à suivre, qui prévenir, quel document remplir…">' + echapper(a.reponse || '') + '</textarea>' +
      '<label for="faq-f-mots">Mots-clés et synonymes (séparés par des virgules)</label>' +
      '<input type="text" id="faq-f-mots" placeholder="absence, deuil, décès, rattrapage" value="' + echapper((a.mots_cles || []).join(', ')) + '">' +
      '<div class="ligne-double"><div>' +
        '<label for="faq-f-cat">Catégorie</label>' +
        '<input type="text" id="faq-f-cat" placeholder="Absences, Matériel, Réclamations…" value="' + echapper(a.categorie || '') + '">' +
      '</div><div>' +
        '<label for="faq-f-relecture">À relire avant le (facultatif)</label>' +
        '<input type="date" id="faq-f-relecture" value="' + echapper(a.relecture_le || '') + '">' +
      '</div></div>' +
      '<label class="faq-case"><input type="checkbox" id="faq-f-publie"' + (a.publie === false ? '' : ' checked') + '> Publié (visible par tous les agents)</label>' +
      '<p class="aide">N\'inscrivez aucun nom de personne dans un article.</p>';

    BFS.core.ouvrirModale(a.id ? 'Modifier l\'article' : 'Nouvel article', corps, [
      { libelle: 'Annuler', classe: 'btn-secondaire', action: BFS.core.fermerModale },
      { libelle: 'Enregistrer', classe: 'btn-principal', action: async function () {
          var titre = $('#faq-f-titre').value.trim();
          var reponse = $('#faq-f-reponse').value.trim();
          if (!titre || !reponse) { BFS.core.notifier('Le titre et la réponse sont obligatoires.', 'erreur'); return; }
          var mots = $('#faq-f-mots').value.split(',').map(function (m) { return m.trim(); }).filter(Boolean);
          try {
            await enregistrer({
              id: a.id, version: a.version, titre: titre, reponse: reponse, mots_cles: mots,
              categorie: $('#faq-f-cat').value.trim(),
              relecture_le: $('#faq-f-relecture').value,
              publie: $('#faq-f-publie').checked
            });
            BFS.core.fermerModale();
            BFS.core.notifier('Article enregistré.', 'succes');
            await charger();
          } catch (err) {
            BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
          }
        } }
    ]);
  }

  function confirmerSuppression(a) {
    BFS.core.ouvrirModale('Supprimer l\'article ?',
      '<p>« ' + echapper(a.titre) + ' » sera supprimé définitivement.</p>', [
      { libelle: 'Annuler', classe: 'btn-secondaire', action: function () { ouvrirArticle(a); } },
      { libelle: 'Supprimer', classe: 'btn-danger', action: async function () {
          try {
            await supprimer(a.id);
            BFS.core.fermerModale();
            BFS.core.notifier('Article supprimé.', 'succes');
            await charger();
          } catch (err) {
            BFS.core.notifier(BFS.core.traduireErreur(err), 'erreur');
          }
        } }
    ]);
  }

  return {
    afficher: afficher,
    nouvelArticle: function () { formulaire(); },
    initTableauDeBord: initTableauDeBord
  };
})();

BFS.debug.info('faq.js chargé.');
