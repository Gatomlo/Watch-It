# mAIwatch — films et séries à voir

Appli web (PWA) pour un foyer : liste « À voir » / « Vus », notes par profil, suggestions, envies en langage naturel (IA facultative), import. Stack : Node ≥ 22.5 (`node:sqlite`), Express, JS vanilla sans build ; port 3100, base `data/app.db`.

## Fichiers clés
- `src/server.js` : auth + `POST /api/setup` (création du compte à la première visite, code d'installation affiché dans la console), `/api/tmdb-key`, `GET/PUT /api/state` (version `X-State-Version`, `X-Base-Version` → 409), `/api/search|title|availability|providers|suggestions|envies|import`, `/api/ai` (clé IA), statiques.
- `src/db.js` : SQLite (`users`, `app_state` JSON + version, `sessions`, `secrets`, `cache`). `src/keys.js` : clés internes auto-générées (`data/keys.json`). `src/cryptoBox.js` : AES-256-GCM pour les clés API (TMDB, IA). `src/tmdb.js` : API TMDB + cache. `src/ai.js` : Claude / Gemini / Mistral. `src/engine.js` : suggestions, envies, « Bientôt ». `src/importers.js` : Letterboxd (RSS) et Trakt. `src/push.js` : Web Push (clés VAPID en base, `watch()` toutes les 6 h).
- `public/app.js` (tout le front : état, synchro, rendu, événements), `styles.css`, `sw.js`, `manifest.json` (partage + raccourcis), `logo.svg` (+ PNG).

## Modèle de données
- État partagé : `{ settings:{region, platforms[ids TMDB], profiles{M,E}, ratingScale:5}, list[], dismissed{M[],E[]}, match, collections:[{id,name}] }`. `match` = partie « Match à deux » : `{id, deck[], votes:{M:{id:±1},E:{}}}`. Migration serveur unique des anciennes notes 👍/👎 vers les étoiles (`db.js`).
- Entrée de liste : `{ id:'movie:123'|'tv:456', ty:'film'|'serie', t, y, p(affiche), g[noms de genres], len, by:'M'|'E', at, status:'todo'|'seen', r:{M,E: 1..5 étoiles}, prog:{s,e} (séries), l:[ids de collections], note, av:{f[]}, alert }`. Le profil actif de l'appareil (`me`) reste dans localStorage, hors état synchronisé.
- Disponibilité (`AV`) : récupérée à l'ouverture (cache 6 h), jamais synchronisée ; `detectChanges` compare à `e.av` pour les alertes « N'est plus sur… ».
- Suggestions : score = Σ poids (étoiles : (note − 3) × 1,5 ; ajouté +1 / +0,4 si ajouté par l'autre ; refusé −2) × proximité (recommandations TMDB + genres communs), filtrées sur les plateformes du foyer.
- Synchro / hors-ligne : état gardé dans localStorage puis envoyé au serveur ; en cas de 409, fusion à trois (`merge3`, réessai 15 s, `dirty`). Listes d'objets fusionnées par `id` (chaîne).
- Réglages : menu de rubriques (`ui.sset` = menu|plats|profils|lists|tmdb|ai|notif|theme|account), chacune une sous-page ; `PVL` = liste complète des plateformes TMDB de la région (ordre de popularité), `PV` = index par id. `POST /api/account/username` change l'identifiant.
- Clés API (TMDB, IA, Trakt) : lecture seule une fois enregistrées ; modification (`ui.keyEdit`) et retrait (`ui.keyConfirm`, confirmation) explicites. Installation PWA : `beforeinstallprompt` (`deferredInstall`) → bandeau sur l'accueil (masquable, `maiwatch-install-hidden`) + Réglages > Installer l'application (mode d'emploi iPhone / Android / ordinateur).
- Plateformes : TMDB liste une même plateforme sous plusieurs ids (« Amazon Prime Video » ×2, « … with Ads », « HBO Max » / « Max »). `famKey(nom)` regroupe ces variantes ; choisir une plateforme (réglages ou filtre) ajoute tous les ids de sa famille, et `expandSelected()` complète une sélection existante au chargement de `PVL`. Bande-annonce : feuille `trailer` avec iframe `youtube-nocookie.com/embed/…` (la couche n'est pas re-rendue tant qu'elle est ouverte, pour ne pas relancer la vidéo).
- Partage vers l'appli (`share_target`, GET `?title=&text=&url=`) : `handleLaunch` + `titleFromShare` extrait le titre d'un texte du type « Regardez X sur Prime Video ! » ou « X - Netflix » ; la recherche de l'écran Ajouter applique la même extraction à tout texte saisi.
- Thème : `data-theme` sur `<html>` (dark|light|auto, localStorage `maiwatch-theme`), jetons CSS dans `styles.css`.
- Filtres : type conservé d'un onglet à l'autre ; plateformes, genres et listes remis à zéro au changement d'onglet.
- « Ce soir » : `ui.tb` = temps disponible (durée ou début/fin) → `minutes` envoyé à `/api/envies` (borne durée des films et des épisodes) ; l'heure de fin estimée est calculée côté client (`endNote`).
- Import Netflix : CSV analysé côté client (`parseNetflix`, `netflixTitles` : « Série: Saison n: épisode » = série) puis `/api/import` avec `hints` (film/serie) pour départager les homonymes.

## Commandes
- `npm install`, `npm start` (aucun `.env` : compte créé à la première visite avec le code d'installation de la console, clés TMDB et IA saisies dans l'appli). Test isolé : `PORT`, `DATA_DIR` et `TMDB_BASE` (faux TMDB) dédiés ; `AI_BASE_CLAUDE|GEMINI|MISTRAL` pour un faux fournisseur IA.
- Pas de tests automatisés ; vérifier au minimum `node --check` sur chaque fichier modifié.
- Ne jamais versionner `.env`, `data/` (base et `keys.json`). Ne jamais mettre de clé API dans le dépôt ni dans le navigateur.
- Git : https://github.com/Gatomlo/mAIwatch (public).
