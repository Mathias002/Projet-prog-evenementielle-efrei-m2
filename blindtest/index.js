const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = {};

const users = new Map();

// Helper to get all audio files
function getAudioFiles() {
  const audioDir = path.join(__dirname, "audio");
  return fs.readdirSync(audioDir).filter((file) => file.endsWith(".mp3"));
}

// Génère un identifiant unique pour chaque musique lancée
function generateMusicId() {
  return Math.random().toString(36).substring(2, 10);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function log(type, message, data = null) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${type}] ${message}`, data ? data : "");
}

function validatePlayerName(name) {
  if (!name) return "EMPTY_NAME";
  if (name.length < 3) return "NAME_TOO_SHORT";
  if (name.length > 15) return "NAME_TOO_LONG";
  return null;
}

io.on("connection", (socket) => {
  console.log("🟢 Nouveau client connecté :", socket.id);

  socket.on("join_room", ({ roomName, playerName }) => {
    const room = rooms[roomName];

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

    // Enregistre le joueur sous son socket id (conserve les autres joueurs)
    room.players[socket.id] = playerName;
    // Initialise l'état prêt à false pour le nouveau joueur
    room.readyPlayers[socket.id] = false;
    socket.join(roomName);

    // Informe tous les clients dans la room de la mise à jour
    io.to(roomName).emit("room_updated", {
      players: room.players,
      readyPlayers: room.readyPlayers,
    });

    // Répond au client qui vient de rejoindre pour qu'il puisse naviguer/mettre à jour son état
    socket.emit("join_room_response", {
      success: true,
      data: {
        roomCode: roomName,
        players: room.players,
        readyPlayers: room.readyPlayers,
      },
    });

    console.log(`👤 ${playerName} a rejoint ${roomName}`);
  });

  // ✨ NOUVEAU: Gérer l'état "prêt" d'un joueur
  socket.on("toggle_ready", ({ roomCode }) => {
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("toggle_ready_response", {
        success: false,
        error: { code: "ROOM_NOT_FOUND", message: "Room introuvable" },
      });
      return;
    }

    if (!room.players[socket.id]) {
      socket.emit("toggle_ready_response", {
        success: false,
        error: {
          code: "NOT_IN_ROOM",
          message: "Vous n'êtes pas dans cette room",
        },
      });
      return;
    }

    // Toggle l'état prêt du joueur
    room.readyPlayers[socket.id] = !room.readyPlayers[socket.id];

    const playerName = room.players[socket.id];
    const isReady = room.readyPlayers[socket.id];

    log("INFO", `${playerName} est ${isReady ? "prêt" : "pas prêt"}`, {
      roomCode,
    });

    // Envoie la mise à jour à tous les joueurs de la room
    io.to(roomCode).emit("room_updated", {
      players: room.players,
      readyPlayers: room.readyPlayers,
    });

    socket.emit("toggle_ready_response", {
      success: true,
      data: { isReady },
    });
  });

  // ✨ NOUVEAU: Lancer la partie (uniquement si tous sont prêts)
  socket.on("start_game", ({ roomCode }) => {
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("start_game_response", {
        success: false,
        error: { code: "ROOM_NOT_FOUND", message: "Room introuvable" },
      });
      return;
    }

    // Vérifie que tous les joueurs sont prêts
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

    log("SUCCESS", "Lancement de la partie", { roomCode });

    // Informe tous les joueurs que la partie commence
    io.to(roomCode).emit("game_started", {
      roomCode,
      players: room.players,
    });
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.players[socket.id]) {
        const playerName = room.players[socket.id];
        delete room.players[socket.id];
        delete room.readyPlayers[socket.id];

        io.to(roomCode).emit("room_updated", {
          players: room.players,
          readyPlayers: room.readyPlayers,
        });

        log("INFO", `${playerName} a quitté ${roomCode}`);

        if (Object.keys(room.players).length === 0) {
          delete rooms[roomCode];
          console.log(`❌ Room supprimée : ${roomCode}`);
        }
      }
    }
  });

  socket.on("create_room", ({ playerName }) => {
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

    rooms[roomCode] = {
      players: {
        [socket.id]: playerName,
      },
      readyPlayers: {
        [socket.id]: false, // Le créateur n'est pas prêt par défaut
      },
      createdAt: Date.now(),
      scores: {},
      currentMusic: null,
      musicStartTime: null,
    };

    socket.join(roomCode);

    log("SUCCESS", "Room créée", {
      roomCode,
      host: playerName,
    });

    socket.emit("create_room_response", {
      success: true,
      data: {
        roomCode,
        players: rooms[roomCode].players,
        readyPlayers: rooms[roomCode].readyPlayers,
      },
    });
  });

  // --- Blindtest Socket.io Events ---

  // Lancer une séquence de 10 musiques (événement de démarrage du jeu)
  socket.on("blindtest_game_start", async ({ roomCode }) => {
    if (!roomCode || !rooms[roomCode]) {
      socket.emit("blindtest_error", { error: "Room not found" });
      return;
    }
    const audioFiles = getAudioFiles();
    if (audioFiles.length < 10) {
      io.to(roomCode).emit("blindtest_error", {
        error: "Not enough audio files (need at least 10)",
      });
      return;
    }

    // Mélange et sélectionne 10 musiques
    const shuffled = audioFiles.sort(() => 0.5 - Math.random());
    const sequence = shuffled.slice(0, 10);

    rooms[roomCode].blindtestSequence = sequence;
    rooms[roomCode].blindtestIndex = 0;
    rooms[roomCode].scores = {};
    rooms[roomCode].answers = {}; // Pour stocker les réponses des joueurs à chaque musique

    // Fonction pour lancer chaque musique et attendre les réponses
    const launchMusic = async (index) => {
      if (index >= sequence.length) {
        // Fin du jeu
        io.to(roomCode).emit("blindtest_game_end", {
          scores: rooms[roomCode].scores,
        });
        return;
      }

      const chosenFile = sequence[index];
      const musicId = generateMusicId();

      rooms[roomCode].currentMusic = {
        id: musicId,
        filename: chosenFile,
      };
      rooms[roomCode].musicStartTime = Date.now();
      rooms[roomCode].answers = {}; // Reset les réponses pour cette musique

      io.to(roomCode).emit("blindtest_music", {
        musicId: musicId,
        url: `/blindtest/audio/stream/${musicId}`,
        startTime: rooms[roomCode].musicStartTime,
        index: index + 1,
        total: sequence.length,
      });

      // Attend 30 secondes ou jusqu'à ce que tous les joueurs aient répondu
      let timeoutReached = false;
      const players = Object.values(rooms[roomCode].players);

      const waitForAnswers = () =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            timeoutReached = true;
            cleanup();
            resolve();
          }, 30000);

          // Ecoute les réponses
          const answerListener = ({ roomCode: rc, playerName, answer }) => {
            if (rc !== roomCode) return;
            if (!rooms[roomCode].answers) rooms[roomCode].answers = {};
            if (!rooms[roomCode].answers[playerName]) {
              rooms[roomCode].answers[playerName] = answer;
            }
            // Si tous les joueurs ont répondu, on arrête le timer
            if (
              Object.keys(rooms[roomCode].answers).length === players.length &&
              !timeoutReached
            ) {
              clearTimeout(timer);
              cleanup();
              resolve();
            }
          };

          function cleanup() {
            socket.removeListener("blindtest_answer", answerListener);
          }

          socket.on("blindtest_answer", answerListener);
        });

      await waitForAnswers();

      // Calcul des scores pour cette musique
      const baseName = chosenFile.replace(/\.mp3$/i, "").trim();

      // Normaliser une chaîne : supprimer accents, ponctuation (sauf lettres/nombres/espaces), mettre en minuscule et compacter les espaces
      function normalizeStr(str) {
        if (!str) return "";
        return str
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "") // enlève les accents
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, "") // garde seulement lettres/nombres/espaces
          .replace(/\s+/g, " ")
          .trim();
      }

      // Extraire titre / artiste à partir du nom de fichier (ex : "Titre - Artiste.mp3")
      const parts = baseName
        .split("-")
        .map((p) => p.trim())
        .filter(Boolean);
      let title = "";
      let artist = "";
      if (parts.length === 0) {
        title = baseName;
      } else if (parts.length === 1) {
        title = parts[0];
      } else {
        title = parts[0];
        artist = parts.slice(1).join(" - ");
      }

      const normalizedTitle = normalizeStr(title);
      const normalizedArtist = normalizeStr(artist);
      const normalizedBase = normalizeStr(baseName);

      // Construire un ensemble de réponses acceptables :
      // - titre seul
      // - artiste seul
      // - "titre artiste" et "artiste titre" (sans le "-")
      // - nom de fichier normalisé (avec ou sans "-")
      const acceptableAnswers = new Set();
      if (normalizedTitle) acceptableAnswers.add(normalizedTitle);
      if (normalizedArtist) acceptableAnswers.add(normalizedArtist);
      if (normalizedTitle && normalizedArtist) {
        acceptableAnswers.add(`${normalizedTitle} ${normalizedArtist}`);
        acceptableAnswers.add(`${normalizedArtist} ${normalizedTitle}`);
        acceptableAnswers.add(normalizedBase.replace(/\s*-\s*/g, " "));
      }
      acceptableAnswers.add(normalizedBase);

      if (!rooms[roomCode]) {
        return;
      }
      const startTime = rooms[roomCode].musicStartTime;
      const now = Date.now();

      for (const playerName of players) {
        const answer = rooms[roomCode].answers[playerName];
        let points = 0;
        let isCorrect = false;
        if (answer) {
          const normalizedAnswer = normalizeStr(answer);
          if (acceptableAnswers.has(normalizedAnswer)) {
            isCorrect = true;
            const elapsedSeconds = Math.floor((now - startTime) / 1000);
            points = Math.max(100 - elapsedSeconds * 10, 10);
          }
        }
        rooms[roomCode].scores[playerName] =
          (rooms[roomCode].scores[playerName] || 0) + points;
        // Envoie le résultat individuel
        io.to(roomCode).emit("blindtest_result", {
          playerName,
          correct: isCorrect,
          points,
          totalScore: rooms[roomCode].scores[playerName],
          elapsedSeconds: answer ? Math.floor((now - startTime) / 1000) : null,
        });
      }

      // Met à jour tous les scores de la room
      io.to(roomCode).emit("blindtest_scores", {
        scores: rooms[roomCode].scores,
      });

      // Passe à la musique suivante
      rooms[roomCode].blindtestIndex = index + 1;
      setTimeout(() => {
        launchMusic(index + 1);
      }, 2000); // Petite pause de 2s entre chaque musique
    };

    // Démarre la séquence
    launchMusic(0);
  });

  // Réponse d'un joueur (pour la séquence, stocke juste la réponse côté serveur)
  socket.on("blindtest_answer", ({ roomCode, playerName, answer }) => {
    if (!roomCode || !rooms[roomCode]) {
      socket.emit("blindtest_result", { error: "Room not found" });
      return;
    }
    if (!playerName) {
      socket.emit("blindtest_result", { error: "Player name required" });
      return;
    }
    // Stocke la réponse pour le joueur dans la room, pour la musique en cours
    if (!rooms[roomCode].answers) rooms[roomCode].answers = {};
    if (!rooms[roomCode].answers[playerName]) {
      rooms[roomCode].answers[playerName] = answer;
    }
    // Le calcul des points se fait à la fin du timer ou quand tous les joueurs ont répondu
    // (voir la logique dans blindtest_game_start)
  });

  socket.emit("connected", { socketId: socket.id });
});

server.listen(3001, () => {
  console.log("🚀 Server lancé sur http://localhost:3001");
});
