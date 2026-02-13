const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Store = require("./store");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    // methods: ["GET", "POST"],
  },
});

// --- VARIABLES EN RAM ---
// const rooms = {}; // SUPPRIMÉ (Géré par Redis)
// const activeUsers = new Map(); // SUPPRIMÉ (Géré par Redis)
// const userRooms = new Map(); // SUPPRIMÉ (Géré par Redis)

// Stocke les liens temporaires vers les fichiers audio (ID -> Nom du fichier)
const activeStreams = new Map();

// Stocke les timeouts de suppression
const disconnectTimeouts = new Map();

// Permet de récupérer les fichiers mp3 dans le dossier `audio`
function getAudioFiles() {
  const audioDir = path.join(__dirname, "audio");
  return fs.readdirSync(audioDir).filter((file) => file.endsWith(".mp3"));
}

// unique id pour music
function generateMusicId() {
  return Math.random().toString(36).substring(2, 10);
}

// Permet de générer un code aléatoire pour les rooms
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Permet de styliser les logs dans le terminal du server
function log(type, message, data = null) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${type}] ${message}`, data ? data : "");
}

// Permet de valider le pseudo renseigner pas l'utilisateur
function validatePlayerName(name) {
  if (!name) return "EMPTY_NAME";
  if (name.length < 3) return "NAME_TOO_SHORT";
  if (name.length > 15) return "NAME_TOO_LONG";
  return null;
}

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;

  if (sessionID) {
    // On attache le sessionID à l'objet socket pour pouvoir l'utiliser plus tard
    socket.sessionID = sessionID;
    return next();
  }

  // Si pas d'ID, on refuse la connexion (optionnel)
  return next(new Error("Authentification invalide"));
});

io.on("connection", async (socket) => {
  log("INFO", "🟢 Nouveau client connecté :", socket.id);

  // Initialisation du sessionID depuis le socket
  const sID = socket.sessionID;

  // Annulation de la suppression si le joueur reviens après le délai
  if (disconnectTimeouts.has(sID)) {
    log("INFO", `${sID} est revenu à temps.`);
    clearTimeout(disconnectTimeouts.get(sID));
    disconnectTimeouts.delete(sID);
  }

  // --- RECONNEXION AUTOMATIQUE (REDIS) ---
  // On récupère la liste des rooms depuis Redis
  const myRooms = await Store.getUserRooms(sID);

  if (myRooms && myRooms.length > 0) {
    // On boucle avec Promise.all pour gérer l'async proprement
    await Promise.all(
      myRooms.map(async (roomCode) => {
        const room = await Store.getRoom(roomCode); // Récup depuis Redis

        if (room && room.players[sID]) {
          // Mise à jour locale
          room.players[sID].online = true;

          // SAUVEGARDE REDIS
          await Store.saveRoom(roomCode, room);

          socket.join(roomCode);

          socket.emit("room_updated", {
            roomCode: roomCode,
            hostId: room.hostId,
            players: room.players,
            readyPlayers: room.readyPlayers,
          });
          log("INFO", `🔄 Restauration état room ${roomCode} pour ${sID}`);
        }
      }),
    );
  }

  // Mappe sessionID -> socketID dans Redis
  await Store.saveSessionSocket(sID, socket.id);

  socket.on("create_room", async ({ playerName }) => {
    log("INFO", "Demande création de room", { socketId: socket.id });

    const errorCode = validatePlayerName(playerName);

    if (errorCode) {
      log("WARN", "Pseudo invalide", { playerName, errorCode });

      socket.emit("create_room_response", {
        success: false,
        error: {
          code: errorCode,
          message: "Pseudo invalide (3 à 15 caractères)",
        },
      });
      return;
    }

    const roomCode = generateRoomCode();

    // structure de l'objet room à améliorer
    const newRoom = {
      hostId: socket.sessionID,
      players: {
        [socket.sessionID]: playerName,
      },
      readyPlayers: {
        [socket.sessionID]: false, // Le créateur n'est pas prêt par défaut
      },
      createdAt: Date.now(),
      scores: {},
      currentMusic: null,
      musicStartTime: null,
    };

    // On sauvegarde l'info pour le prochain refresh
    // if (!userRooms.has(sID)) userRooms.set(sID, new Set());

    // SAUVEGARDE REDIS
    await Store.saveRoom(roomCode, newRoom);
    await Store.addUserToRoomList(sID, roomCode);

    socket.join(roomCode);

    log("SUCCESS", "Room créée", {
      roomCode,
      host: playerName,
    });

    socket.emit("create_room_response", {
      success: true,
      data: {
        roomCode,
        hostId: socket.sessionID,
        players: newRoom.players,
        readyPlayers: newRoom.readyPlayers,
      },
    });
  });

  socket.on("join_room", async ({ roomName, playerName }) => {
    const upperRoomCode = roomName.toUpperCase();

    // REDIS GET
    const room = await Store.getRoom(upperRoomCode);

    if (!room) {
      socket.emit("join_room_response", {
        success: false,
        error: { code: "ROOM_NOT_FOUND", message: "Room introuvable" },
      });
      return;
    }

    const errorCode = validatePlayerName(playerName);
    if (errorCode) {
      socket.emit("join_room_response", {
        success: false,
        error: {
          code: errorCode,
          message: "Pseudo invalide (3 à 15 caractères)",
        },
      });
      return;
    }

    // Ajouter user à la liste de la room dans Redis
    await Store.addUserToRoomList(sID, upperRoomCode);

    // Modifier la room
    room.players[socket.sessionID] = { name: playerName, online: true };
    room.readyPlayers[socket.sessionID] = false;

    // SAUVEGARDE REDIS
    await Store.saveRoom(upperRoomCode, room);

    // // On sauvegarde l'info pour le prochain refresh
    // if (!userRooms.has(sID)) userRooms.set(sID, new Set());

    // userRooms.get(sID).add(upperRoomCode);

    // // Enregistre le joueur sous son sessionID
    // room.players[socket.sessionID] = playerName;

    // room.players[socket.sessionID].online = true;

    // if (!room.readyPlayers) room.readyPlayers = {};

    // // Initialise l'état prêt à false pour le nouveau joueur
    // if (room.readyPlayers[socket.sessionID] === undefined) {
    //   room.readyPlayers[socket.sessionID] = false;
    // }

    socket.join(upperRoomCode);

    io.to(upperRoomCode).emit("room_updated", {
      hostId: room.hostId,
      players: room.players,
      readyPlayers: room.readyPlayers,
    });

    socket.emit("join_room_response", {
      success: true,
      data: {
        roomCode: upperRoomCode,
        hostId: room.hostId,
        players: room.players,
        readyPlayers: room.readyPlayers,
      },
    });

    log("INFO", `👤 ${playerName} a rejoint ${upperRoomCode}`);
  });

  // Gérer l'état "prêt" d'un joueur
  socket.on("toggle_ready", async ({ roomCode }) => {
    const upperRoomCode = roomCode.toUpperCase();
    // const room = rooms[upperRoomCode];

    // REDIS GET
    const room = await Store.getRoom(upperRoomCode);

    if (!room) {
      socket.emit("toggle_ready_response", {
        success: false,
        error: { code: "ROOM_NOT_FOUND", message: "Room introuvable" },
      });
      return;
    }

    const userId = socket.sessionID;

    if (!room.players[userId]) {
      socket.emit("toggle_ready_response", {
        success: false,
        error: {
          code: "NOT_IN_ROOM",
          message: "Vous n'êtes pas dans cette room",
        },
      });
      return;
    }

    // if (!room.readyPlayers) room.readyPlayers = {};

    // // Toggle l'état prêt du joueur
    // room.readyPlayers[userId] = !room.readyPlayers[userId];

    // const playerName = room.players[userId];
    // const isReady = room.readyPlayers[userId];

    // Toggle état
    room.readyPlayers[userId] = !room.readyPlayers[userId];

    // SAUVEGARDE REDIS
    await Store.saveRoom(upperRoomCode, room);

    const playerName = room.players[userId].name;
    const isReady = room.readyPlayers[userId];

    log("INFO", `${playerName} est ${isReady ? "prêt" : "pas prêt"}`, {
      roomCode: upperRoomCode,
    });

    // update tous les joueurs de la room
    io.to(upperRoomCode).emit("room_updated", {
      hostId: room.hostId,
      players: room.players,
      readyPlayers: room.readyPlayers,
    });

    socket.emit("toggle_ready_response", {
      success: true,
      data: { isReady },
    });
  });

  socket.on("leave_room", (roomCode) => {
    const upperRoomCode = roomCode.toUpperCase();
    const room = rooms[upperRoomCode];
    const userId = socket.sessionID;

    if (room && room.players[userId]) {
      delete room.players[userId];
      delete room.readyPlayers[userId];

      socket.leave(upperRoomCode);

      if (room.hostId === sID) {
        const remainingIds = Object.keys(room.players);
        if (remainingIds.length > 0) {
          // On nomme le premier joueur restant comme nouvel hôte
          room.hostId = remainingIds[0];
          log("INFO", `Nouvel hôte pour ${roomCode} : ${room.hostId}`);
        } else {
          // Si plus personne on supprime la room
          delete rooms[roomCode];
          log("INFO", `Room ${roomCode} supprimée (vide)`);
          return;
        }
      }

      io.to(upperRoomCode).emit("room_updated", {
        hostId: room.hostId,
        players: room.players,
        readyPlayers: room.readyPlayers,
      });

      // Si plus de joueur dans la room on la supprime
      if (Object.keys(room.players).length === 0) {
        delete rooms[upperRoomCode];
        log("INFO", `❌ Room supprimée (vide) : ${upperRoomCode}`);
      }
    }
  });

  socket.emit("connected", { socketId: socket.id });

  socket.on("disconnect", async (reason) => {
    log("INFO", `🔴 Déconnexion de ${sID} (Raison: ${reason})`);

    // On lance le compte à rebours de xx secondes
    const timeout = setTimeout(async () => {
      // <--- ASYNC DANS LE TIMEOUT
      log("INFO", `🗑️ Suppression définitive de ${sID}`);

      // Récupérer les rooms de l'utilisateur depuis Redis
      const userRoomsList = await Store.getUserRooms(sID);

      if (userRoomsList && userRoomsList.length > 0) {
        // Pour chaque room : mettre le joueur hors ligne ou le supprimer
        await Promise.all(
          userRoomsList.map(async (roomCode) => {
            const room = await Store.getRoom(roomCode);
            if (!room) return;

            // Supprimer le joueur
            delete room.players[sID];
            delete room.readyPlayers[sID];

            // Gérer le changement de host
            if (room.hostId === sID) {
              const remainingIds = Object.keys(room.players);
              if (remainingIds.length > 0) {
                room.hostId = remainingIds[0];
              } else {
                // Plus personne : supprimer la room de Redis
                await Store.deleteRoom(roomCode);
                return;
              }
            }

            // Si encore du monde, on met à jour la room
            if (Object.keys(room.players).length > 0) {
              await Store.saveRoom(roomCode, room);
              io.to(roomCode).emit("room_updated", {
                /* ... */
              });
            } else {
              // Sécurité double check : supprimer room vide
              await Store.deleteRoom(roomCode);
            }

            // Supprimer le lien user -> room
            await Store.removeUserFromRoomList(sID, roomCode);
          }),
        );
      }

      // Nettoyage final Redis
      await Store.deleteUserRooms(sID);
      await Store.deleteSessionSocket(sID);
      disconnectTimeouts.delete(sID);
    }, 10000);

    // stocke le timeout pour pouvoir l'annuler si le joueur revient
    disconnectTimeouts.set(sID, timeout);
  });

  // Route pour streamer l'audio
  app.get("/blindtest/audio/stream/:id", (req, res) => {
    const musicId = req.params.id;
    const fileName = activeStreams.get(musicId);

    if (!fileName) {
      return res.status(404).send("Lien expiré ou invalide");
    }

    const filePath = path.join(__dirname, "audio", fileName);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).send("Fichier introuvable");
    }
  });

  // Lancer la partie (uniquement si tous sont prêts)
  socket.on("start_game", ({ roomCode }) => {
    const upperRoomCode = roomCode.toUpperCase();
    const room = rooms[upperRoomCode];

    if (!room) {
      socket.emit("start_game_response", {
        success: false,
        error: { code: "ROOM_NOT_FOUND", message: "Room introuvable" },
      });
      return;
    }

    const allPlayers = Object.keys(room.players);
    const allReady = allPlayers.every(
      (socketId) => room.readyPlayers[socketId] === true,
    );

    if (!allReady) {
      socket.emit("start_game_response", {
        success: false,
        error: {
          code: "NOT_ALL_READY",
          message: "Tous les joueurs doivent être prêts",
        },
      });
      return;
    }

    log("SUCCESS", "Lancement de la partie", { roomCode: upperRoomCode });

    // game start emit
    io.to(upperRoomCode).emit("game_started", {
      roomCode: upperRoomCode,
      players: room.players,
    });
  });

  // --- Blindtest Socket.io Events ---

  // Lancer une séquence de 10 musiques (événement de démarrage du jeu)
  socket.on("blindtest_game_start", async ({ roomCode }) => {
    const upperRoomCode = roomCode ? roomCode.toUpperCase() : null;
    if (!upperRoomCode || !rooms[upperRoomCode]) {
      socket.emit("blindtest_error", { error: "Room not found" });
      return;
    }
    const audioFiles = getAudioFiles();
    if (audioFiles.length < 10) {
      io.to(upperRoomCode).emit("blindtest_error", {
        error: "Not enough audio files (need at least 10)",
      });
      return;
    }

    const shuffled = audioFiles.sort(() => 0.5 - Math.random());
    const sequence = shuffled.slice(0, 10);

    rooms[upperRoomCode].blindtestSequence = sequence;
    rooms[upperRoomCode].blindtestIndex = 0;
    rooms[upperRoomCode].scores = {};
    rooms[upperRoomCode].answers = {};

    for (const socketId in rooms[upperRoomCode].players) {
      const playerName = rooms[upperRoomCode].players[socketId];
      rooms[upperRoomCode].scores[playerName] = 0;
    }

    // func lancer musique puis attendre réponses
    const launchMusic = async (index) => {
      if (index >= sequence.length) {
        // fin du jeu
        io.to(upperRoomCode).emit("blindtest_game_end", {
          scores: rooms[upperRoomCode].scores,
        });
        return;
      }

      const chosenFile = sequence[index];
      const musicId = generateMusicId();

      activeStreams.set(musicId, chosenFile);
      // Nettoyage de sécurité après 20 secondes (le tour dure 15s + pauses)
      setTimeout(() => {
        activeStreams.delete(musicId);
      }, 20000);

      rooms[upperRoomCode].currentMusic = {
        id: musicId,
        filename: chosenFile,
      };
      rooms[upperRoomCode].musicStartTime = Date.now();
      rooms[upperRoomCode].answers = {};
      rooms[upperRoomCode].answeredPlayers = new Set();

      io.to(upperRoomCode).emit("blindtest_music", {
        musicId: musicId,
        url: `/blindtest/audio/stream/${musicId}`,
        startTime: rooms[upperRoomCode].musicStartTime,
        index: index + 1,
        total: sequence.length,
      });

      // normalisation : supprimer accents, ponctuation (sauf lettres/nombres/espaces), mettre en minuscule et compacter les espaces
      function normalizeStr(str) {
        if (!str) return "";
        return (
          str
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "") // Enlève les accents
            .toLowerCase()
            // ^a-z0-9\s -> "tout ce qui n'est PAS lettre, chiffre ou espace"
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .trim()
        );
      }

      rooms[upperRoomCode].normalizeStr = normalizeStr;

      const MIN_LENGTH = 2;

      let cleanerName = chosenFile.replace(/\.mp3$/i, "");
      cleanerName = cleanerName.replace(/(\(|\[).*?(\)|\])/g, "").trim();

      const parts = cleanerName
        .split(/\s+-\s+|_/)
        .map((p) => p.trim())
        .filter((p) => p.length >= MIN_LENGTH);

      let title = "";
      let artist = "";

      if (parts.length === 0) {
        title = cleanerName;
      } else if (parts.length === 1) {
        title = parts[0];
      } else {
        artist = parts[0];
        title = parts.slice(1).join(" ");
      }

      const normalizedTitle = normalizeStr(title);
      const normalizedArtist = normalizeStr(artist);
      const normalizedBase = normalizeStr(cleanerName);

      const acceptableAnswers = new Set();

      if (normalizedTitle.length >= MIN_LENGTH) {
        acceptableAnswers.add(normalizedTitle);
      }

      if (normalizedArtist.length >= MIN_LENGTH) {
        acceptableAnswers.add(normalizedArtist);
      }

      if (
        normalizedTitle.length >= MIN_LENGTH &&
        normalizedArtist.length >= MIN_LENGTH
      ) {
        acceptableAnswers.add(`${normalizedTitle} ${normalizedArtist}`);
        acceptableAnswers.add(`${normalizedArtist} ${normalizedTitle}`);

        const flatBase = normalizedBase.replace(/[^a-z0-9 ]/g, " ").trim();
        if (flatBase.length >= MIN_LENGTH) {
          acceptableAnswers.add(flatBase);
        }
      }

      if (normalizedBase.length >= MIN_LENGTH) {
        acceptableAnswers.add(normalizedBase);
      }

      rooms[upperRoomCode].acceptableAnswers = acceptableAnswers;

      const players = [...new Set(Object.values(rooms[upperRoomCode].players))];

      // Attend 15 secondes ou jusqu'à ce que tous les joueurs aient répondu
      const waitForAnswers = () =>
        new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            resolve();
          }, 15000);

          const intervalId = setInterval(() => {
            if (
              rooms[upperRoomCode] &&
              rooms[upperRoomCode].answeredPlayers.size >= players.length
            ) {
              clearInterval(intervalId);
              clearTimeout(timeoutId);
              resolve();
            }
          }, 200);
        });

      await waitForAnswers();

      // reveal bonne réponse + envoi des scores
      const correctName = chosenFile.replace(/\\.mp3$/i, "");
      io.to(upperRoomCode).emit("blindtest_round_end", {
        correctAnswer: correctName,
        scores: rooms[upperRoomCode].scores,
      });

      rooms[upperRoomCode].blindtestIndex = index + 1;
      setTimeout(() => {
        launchMusic(index + 1);
      }, 5000);
    };

    io.to(upperRoomCode).emit("blindtest_countdown", { seconds: 5 });
    log("INFO", "Début du compte à rebours pour le lancement du jeu");

    setTimeout(() => launchMusic(0), 5000);
  });

  // réponse d'un joueur (stockage côté serveur, sans db pour l'instant)
  socket.on("blindtest_answer", ({ roomCode, answer }) => {
    const upperRoomCode = roomCode.toUpperCase();
    const room = rooms[upperRoomCode];
    const playerSocketId = socket.sessionID;
    const playerName = room.players[playerSocketId];

    // log("INFO", "room : ", room);
    // log("INFO", "playerName : ", playerName);
    // log("INFO", "room.currentMusic : ", room.currentMusic);

    if (!room || !playerName || !room.currentMusic) {
      socket.emit("blindtest_error", { message: "Cannot submit answer." });
      return;
    }
    if (room.answeredPlayers.has(playerName)) {
      socket.emit("blindtest_result", {
        playerName,
        correct: true,
        points: 0,
        totalScore: room.scores[playerName],
        elapsedSeconds: null,
        message: "You have already answered correctly for this song.",
      });
      return;
    }

    const musicStartTime = room.musicStartTime;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - musicStartTime) / 1000);

    let points = 0;
    let isCorrect = false;

    const normalizedAnswer = room.normalizeStr(answer);

    if (room.acceptableAnswers.has(normalizedAnswer)) {
      isCorrect = true;
      points = Math.max(100 - elapsedSeconds * 10, 10);

      room.scores[playerName] = (room.scores[playerName] || 0) + points;
    }

    room.answeredPlayers.add(playerName);

    io.to(upperRoomCode).emit("blindtest_result", {
      playerName,
      correct: isCorrect,
      points,
      totalScore: room.scores[playerName],
      elapsedSeconds,
    });
  });

  // --- Blindtest Socket.io Events ---
});

server.listen(3001, () => {
  console.log("🚀 Server lancé sur http://localhost:3001");
});
