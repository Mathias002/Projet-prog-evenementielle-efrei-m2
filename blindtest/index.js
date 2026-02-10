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

io.on("connection", (socket) => {
  console.log("🟢 Nouveau client connecté :", socket.id);

  socket.emit("connected", { socketId: socket.id });

  socket.on("disconnect", () => {
    console.log("🔴 Client déconnecté :", socket.id);
  });
});

server.listen(3001, () => {
  console.log("🚀 Server lancé sur http://localhost:3001");
});
