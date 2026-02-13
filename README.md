# Projet-prog-evenementielle-efrei-m2

## Description

Ce projet est une application de blind-test (jeu musical) multijoueur temps réel construite avec :

- Un serveur Node.js / Express + Socket.IO (dans le dossier `blindtest`) qui gère les rooms, la logique du jeu et le streaming temporaire des fichiers audio.
- Un client React (Vite) (dans le dossier `client`) qui fournit l'UI : page d'accueil (création / rejoint de room), lobby et écran de jeu.

## But principal

Permettre à plusieurs joueurs de se rejoindre dans une "room", se préparer (ready), puis lancer une partie de blind-test où des extraits audio sont streamés depuis le serveur et chaque joueur envoie sa réponse. Le score est calculé côté serveur selon la rapidité et l'exactitude de la réponse.

## Table des matières

- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Installation & lancement](#installation--lancement)
  - [Serveur (blindtest)](#serveur-blindtest)
  - [Client (React)](#client-react)
- [Flux d'utilisation](#flux-dutilisation)
- [API Socket.IO (événements)](#api-socketio-événements)
- [Endpoint REST / Streaming audio](#endpoint-rest--streaming-audio)
- [Ajouter / gérer des musiques](#ajouter--gérer-des-musiques)
- [Structure détaillée des fichiers](#structure-détaillée-des-fichiers)
- [Développement & debug](#développement--debug)
- [Problèmes connus & conseils](#problèmes-connus--conseils)
- [Contribution](#contribution)
- [Auteurs / Contact](#auteurs--contact)
- [Licence](#licence)

## Structure du projet

Racine:

- `blindtest/` — serveur Node.js + fichiers audio (+ index.js)
  - `audio/` — mp3 utilisés pour le blind-test
  - `index.js` — code serveur (Express + Socket.IO)
  - `package.json` — scripts et dépendances serveur
- `client/` — application frontend React (Vite)
  - `src/` — code React (components : HomePage, Lobby, Game, socket wrapper, ...)
  - `package.json` — scripts et dépendances frontend
- `README.md` — (vous lisez ce fichier)

## Prérequis

- Node.js (recommandé >= 18)
- npm ou yarn
- Un navigateur moderne pour le client (Chrome / Firefox / Edge)

## Installation & lancement

1. Serveur (dossier `blindtest`)

- Aller dans le dossier serveur :
  - `cd blindtest`
- Installer les dépendances :
  - `npm install`
- Lancer le serveur en développement :
  - `npm run dev` (ou `node index.js`)

Par défaut le serveur écoute sur le port `3001`.

2. Client (dossier `client`)

- Aller dans le dossier client :
  - `cd client`
- Installer les dépendances :
  - `npm install`
- Lancer le client (Vite) :
  - `npm run dev`
- Ouvrir le navigateur à l'URL indiquée par Vite (généralement `http://localhost:5173`).

## Flux d'utilisation (utilisateur)

1. Sur la page d'accueil : entrez un pseudo puis choisissez `Créer une room` ou `Rejoindre`.
2. Si vous créez une room, vous devenez l'hôte ; la room est créée côté serveur et vous êtes redirigé vers le `Lobby`.
3. Dans le `Lobby`, chaque joueur peut activer son statut "Prêt". Quand tous les joueurs sont prêts, l'hôte peut lancer la partie.
4. Le jeu : une séquence de musiques est jouée. Les extraits sont streamés depuis le serveur ; chaque joueur envoie sa réponse. Le serveur calcule les points (plus rapide = plus de points).
5. À la fin de la séquence, le serveur envoie les scores finaux et la partie se termine.

## API Socket.IO (événements et payloads principaux)

Les événements listés ici correspondent à ceux implémentés dans `blindtest/index.js` et le client React.

Événements envoyés par le client -> serveur

- `create_room` : { playerName }
- `join_room` : { roomName, playerName }
- `toggle_ready` : { roomCode }
- `leave_room` : roomCode (string)
- `start_game` : { roomCode }
- `blindtest_game_start` : { roomCode } (émis par l'hôte pour déclencher la séquence de musiques)
- `blindtest_answer` : { roomCode, answer } (envoyer une réponse pendant un round)

Événements envoyés par le serveur -> client

- `create_room_response` : { success, data?, error? }
- `join_room_response` : { success, data?, error? }
- `toggle_ready_response` : { success, data?, error? }
- `start_game_response` : { success, data?, error? }
- `room_updated` : { roomCode, hostId, players, readyPlayers }
- `game_started` : { roomCode, players } (navigation vers l'écran de jeu)
- `blindtest_countdown` : { seconds } (compte à rebours avant début de la musique)
- `blindtest_music` : { musicId, url, startTime, index, total } (lancement d'un extrait)
- `blindtest_result` : { playerName, correct, points, totalScore, elapsedSeconds }
- `blindtest_round_end` : { correctAnswer, scores }
- `blindtest_game_end` : { scores }
- `blindtest_error` : { error } / { message }
- `connected` : { socketId }

Remarques :

- Le client utilise un `sessionID` persistant (stocké dans `localStorage`) pour identifier les joueurs de manière continue, même s'ils se reconnectent avec un socket id différent. Clé côté client : `gameUserId`.
- Le serveur valide les pseudos (longueur 3..15) et renvoie des codes d'erreur clairs (`ROOM_NOT_FOUND`, `NOT_IN_ROOM`, `NOT_ALL_READY`, etc.).

## Endpoint REST / Streaming audio

- GET `/blindtest/audio/stream/:id`
  - Utilisé par le client pour streamer le mp3 correspondant à `:id` (un identifiant temporaire généré par le serveur).
  - Le serveur garde en mémoire (`activeStreams`) la correspondance `musicId -> filename` pendant un laps de temps limité (pour sécuriser l'accès).
  - Si le lien a expiré ou l'id est invalide, renvoie 404.

## Ajouter / gérer des musiques

- Les fichiers audio sont dans `blindtest/audio/` (mp3).
- Le serveur charge les fichiers du dossier `audio` et en choisit un sous-ensemble pour la séquence.
- Pour ajouter des musiques, placer des fichiers `.mp3` dans `blindtest/audio/`. Veillez au format des noms de fichiers (le serveur essaie d'extraire `artist - title` ou `title` à partir du nom de fichier pour normaliser les réponses).
- Attention : le serveur attend au moins 10 fichiers pour lancer une partie (le code vérifie `audioFiles.length < 10`).

## Structure détaillée des fichiers (fichiers clés)

- `blindtest/index.js` — serveur principal : gestion des rooms, du cycle de vie des joueurs, logique blind-test, streaming audio, Socket.IO handlers.
- `blindtest/package.json` — scripts/dépendances du serveur (Express, socket.io, cors).
- `blindtest/audio/*` — mp3.
- `client/src/socket.js` — wrapper socket côté client (génération / récupération `sessionID`).
- `client/src/components/HomePage/HomePage.jsx` — page d'accueil (create/join).
- `client/src/components/Lobby/Lobby.jsx` — lobby, liste joueurs, ready/start.
- `client/src/components/Game/Game.jsx` — écran du jeu (réception `blindtest_music`, envoi `blindtest_answer`, affichage résultats).
- `client/package.json` — dépendances frontend (react, socket.io-client, vite, ...).

## Développement & debug

- Logs : le serveur utilise une fonction `log()` pour afficher les événements avec timestamp. Vérifiez la console du serveur pour diagnostiquer.
- Reconnexion : le serveur implémente une logique de "timeout de suppression" (5s par défaut) pour permettre de courts délais de reconnexion. Si un utilisateur revient avant la fin du timeout, son état est restauré.
- Points sensibles :
  - Vérifiez que `blindtest/audio/` contient suffisamment de fichiers.
  - Vérifiez que le client peut atteindre le serveur (CORS autorisé, le serveur autorise origin `*`).
  - Si vous utilisez ngrok ou un tunnel, le client `socket.io-client` inclut un extraHeader `ngrok-skip-browser-warning` dans le code fourni.

## Problèmes connus & conseils

- Pas de persist / DB : toutes les rooms et états sont en mémoire ; redémarrer le serveur efface tout.
- Gestion des déconnexions : implémentée mais surveiller comportements lors de multiples reconnexions simultanées.
- Normalisation des réponses : le serveur normalise (suppression d'accents / ponctuation) et compare aux variantes acceptables construites à partir du nom de fichier. Les noms de fichiers mal formatés peuvent produire des correspondances imparfaites.
- Quantité de musiques minimale : code actuel exige au moins 10 mp3 ; adapter si nécessaire.

## Contribution

- Forkez le repo et créez une branche de fonctionnalité.
- Soumettez des PRs : préciser le but et les changements principaux.
- Idées d'amélioration :
  - Persistance des rooms / scores (ajouter une base de données)
  - Authentification utilisateurs (compte, avatars)
  - Interface pour administrer la bibliothèque audio (ajout / suppression / métadonnées)
  - Meilleure gestion des assets statiques et du streaming (range requests / partial content)
  - Tests unitaires / intégration

## Auteurs / Contact

- Projet développé dans le cadre d'un cours - dépôt local : `Projet-prog-evenementielle-efrei-m2`.
- Pour questions techniques, ouvrir une issue / PR dans le repo (ou me contacter via votre canal habituels).

## Licence

Aucune licence n'est fournie dans ce dépôt. Si vous souhaitez réutiliser ou distribuer ce code, ajoutez un fichier `LICENSE` approprié (ex : MIT) ou consultez les auteurs pour clarifier les droits.

## Annexe rapide — commandes utiles

- Lancer le serveur :
  - `cd blindtest && npm install && npm run dev`
- Lancer le client :
  - `cd client && npm install && npm run dev`
