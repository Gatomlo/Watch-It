# mAIwatch

Liste partagée de films et séries à voir, pour un foyer. Un seul compte, deux profils (par défaut « Moi » et « Elle », prénoms modifiables).

- **Liste « À voir »** et **« Vus »** avec notes 👍 / 👎 par profil, filtres (type, plateformes, genres), tirage au sort.
- **Plateformes** : on coche celles du foyer (par pays) ; chaque titre indique où le regarder. Une alerte apparaît quand un titre de la liste quitte ou arrive sur l'une de vos plateformes.
- **Pour vous** : suggestions pour chaque profil et pour les deux, d'après ce qui est aimé (+3), ajouté (+1), refusé (−2) ou pas aimé (−3), limitées à vos plateformes. Boutons « Ajouter », « Déjà vu », « Pas pour moi ».
- **Ce soir** : décrire une envie en une phrase. Sans clé IA, recherche par mots-clés (durée, ton, série ou film). Avec une clé **Claude, Gemini ou Mistral**, la phrase est comprise librement et les candidats sont classés.
- **Import** de titres vus (liste collée, CSV Letterboxd / Trakt / JustWatch), **export** CSV.
- **PWA** : installable, utilisable hors ligne (copie locale, synchronisation au retour du réseau), partage depuis Signal ou le navigateur vers l'appli (Android, appli installée).

Mêmes principes techniques que Fée Lezcomptes : Node.js ≥ 22.5 (`node:sqlite`), Express, front en JS vanilla sans build.

## Démarrage

```bash
git clone https://github.com/Gatomlo/mAIwatch.git && cd mAIwatch
npm install
cp .env.example .env     # puis renseigner SESSION_SECRET, SECRETS_KEY, ADMIN_PASSWORD et TMDB_API_KEY
npm start                # http://localhost:3100  (COOKIE_SECURE=false en local)
```

### Clé TMDB (obligatoire pour les films et séries)

1. Créer un compte gratuit sur [themoviedb.org](https://www.themoviedb.org), puis Réglages > API.
2. Copier la **clé API (v3)** dans `TMDB_API_KEY` (ou le jeton de lecture dans `TMDB_READ_TOKEN`) du fichier `.env`.
3. Usage non commercial uniquement (licence gratuite). Les mentions TMDB et JustWatch sont affichées dans Réglages : à conserver.

### Assistant d'envies (facultatif)

Dans l'appli : Réglages > Assistant d'envies. Choisir Claude, Gemini ou Mistral, coller la clé API, « Enregistrer et tester ».

- La clé est chiffrée (AES-256-GCM, clé `SECRETS_KEY`) dans la base du serveur. Le navigateur n'en reçoit jamais que les 4 derniers caractères.
- Chaque recherche « Ce soir » envoie au fournisseur : la phrase saisie, quelques titres aimés ou non aimés, et une courte liste de candidats TMDB (titre, année, genres, résumé tronqué). L'IA ne propose jamais de titre de son cru : elle ne classe que des candidats venus de TMDB.
- Modèles par défaut modifiables dans `.env` : `AI_MODEL_CLAUDE`, `AI_MODEL_GEMINI`, `AI_MODEL_MISTRAL`.

## Déploiement (même méthode que Fée Lezcomptes)

VPS + pm2 + nginx (port 3100 par défaut) :

```bash
git pull && npm install --omit=dev && pm2 restart maiwatch   # première fois : pm2 start src/server.js --name maiwatch
```

Derrière nginx : `proxy_pass http://127.0.0.1:3100;` avec HTTPS (obligatoire pour installer l'appli et pour `COOKIE_SECURE=true`).
Changer le mot de passe : `npm run set-password -- identifiant nouveau_mot_de_passe`.

## Limites connues

- TMDB ne donne **pas** la date de fin d'un titre sur une plateforme. L'appli compare donc la disponibilité d'une vérification à l'autre (toutes les 6 h, à l'ouverture) et signale « N'est plus sur… » / « Nouveau sur… » pendant 21 jours.
- La disponibilité vient de TMDB (données JustWatch) : elle peut avoir quelques heures de retard.
- Le partage depuis une autre appli (`share_target`) ne fonctionne que pour l'appli installée sur Android (Chrome).
