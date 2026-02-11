const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = {};

const users = new Map();

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

    console.log(roomName);
    console.log(playerName);
    console.log(room);

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
    socket.join(roomName);

    // Informe tous les clients dans la room de la mise à jour
    io.to(roomName).emit("room_updated", {
      players: room.players,
    });

    // Répond au client qui vient de rejoindre pour qu'il puisse naviguer/mettre à jour son état
    socket.emit("join_room_response", {
      success: true,
      data: {
        roomCode: roomName,
        players: room.players,
      },
    });

    console.log(`👤 ${playerName} a rejoint ${roomName}`);
    console.log(`${room.players[socket.id]}`);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.players[socket.id]) {
        delete room.players[socket.id];

        io.to(roomCode).emit("room_updated", {
          players: room.players,
        });

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
      createdAt: Date.now(),
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
      },
    });
  });

  socket.emit("connected", { socketId: socket.id });
});

server.listen(3001, () => {
  console.log("🚀 Server lancé sur http://localhost:3001");
});
