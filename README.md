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
npm start          # http://localhost:3100
```

**Aucun fichier `.env` à écrire.** Tout se règle dans l'appli :

1. **Compte** : au premier démarrage, le serveur affiche un *code d'installation* dans sa console (en production : `pm2 logs maiwatch`). À la première visite du site, l'appli propose de créer le compte du foyer (identifiant + mot de passe) et demande ce code, pour que personne d'autre ne puisse le créer avant vous. Le code n'existe que tant qu'aucun compte n'est créé. Code introuvable (journal vidé ou défilé) : `pm2 restart maiwatch` puis `pm2 logs maiwatch --lines 20` ; un nouveau code est généré à chaque démarrage tant qu'il n'y a pas de compte.
2. **Clé TMDB** (obligatoire pour les films et séries) : juste après, l'appli vous guide. Compte gratuit sur [themoviedb.org](https://www.themoviedb.org), Réglages > API, puis collez la « Clé d'API » (ou le jeton de lecture) dans l'appli : elle est vérifiée auprès de TMDB, puis chiffrée en base. Usage non commercial uniquement ; les mentions TMDB et JustWatch affichées dans Réglages sont à conserver.
3. **Plateformes** du foyer et **assistant d'envies** (facultatif) : Réglages.

Les clés internes (signature des sessions, chiffrement des clés API) sont générées automatiquement dans `data/keys.json` (droits 600). **Sauvegardez le dossier `data/` en entier** (`app.db` et `keys.json`) : sans `keys.json`, il faudrait se reconnecter et ressaisir les clés API.

### Assistant d'envies (facultatif)

Réglages > Assistant d'envies : choisir Claude, Gemini ou Mistral, coller la clé API, « Enregistrer et tester ».

- La clé est chiffrée (AES-256-GCM) dans la base du serveur. Le navigateur n'en reçoit jamais que les 4 derniers caractères.
- Chaque recherche « Ce soir » envoie au fournisseur : la phrase saisie, quelques titres aimés ou non aimés, et une courte liste de candidats TMDB (titre, année, genres, résumé tronqué). L'IA ne propose jamais de titre de son cru : elle ne classe que des candidats venus de TMDB.

### Options avancées (jamais nécessaires)

Variables d'environnement facultatives : `PORT` (3100), `DATA_DIR` (`./data`), `COOKIE_SECURE` (`auto` par défaut : le cookie devient sécurisé dès que le site est servi en HTTPS), `AI_MODEL_CLAUDE`, `AI_MODEL_GEMINI`, `AI_MODEL_MISTRAL`. Un fichier `.env` est lu s'il existe.

## Déploiement (même méthode que Fée Lezcomptes)

VPS + pm2 + nginx (port 3100 par défaut) :

```bash
git pull && npm install --omit=dev && pm2 restart maiwatch   # première fois : pm2 start src/server.js --name maiwatch
```

Derrière nginx : `proxy_pass http://127.0.0.1:3100;` avec HTTPS (obligatoire pour installer l'appli) et les en-têtes `X-Forwarded-Proto` / `X-Forwarded-For`.
Mot de passe oublié : `npm run set-password -- identifiant nouveau_mot_de_passe` (sinon, Réglages > Compte).

## Limites connues

- TMDB ne donne **pas** la date de fin d'un titre sur une plateforme. L'appli compare donc la disponibilité d'une vérification à l'autre (toutes les 6 h, à l'ouverture) et signale « N'est plus sur… » / « Nouveau sur… » pendant 21 jours.
- La disponibilité vient de TMDB (données JustWatch) : elle peut avoir quelques heures de retard.
- Le partage depuis une autre appli (`share_target`) ne fonctionne que pour l'appli installée sur Android (Chrome).
