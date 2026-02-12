const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

var roomCode = null;

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // Créer une room
  socket.emit("create_room", { playerName: "Alice" });

  socket.on("create_room_response", (data) => {
    console.log("Room created:", data);
    roomCode = data.data.roomCode;

    // Démarrer le jeu
    socket.emit("blindtest_game_start", { roomCode: data.data.roomCode });
  });

  socket.on("blindtest_music", (data) => {
    console.log("Music:", data);

    // Simuler une réponse
    setTimeout(() => {
      socket.emit("blindtest_answer", {
        roomCode: roomCode,
        playerName: "Alice",
        answer: "GOOD NIGHT",
      });
    }, 1000); // Répond après 5 secondes
  });

  socket.on("blindtest_result", (data) => {
    console.log("Result:", data);
  });

  socket.on("blindtest_scores", (data) => {
    console.log("Scores:", data);
  });

  socket.on("blindtest_game_end", (data) => {
    console.log("Game end:", data);
    socket.disconnect();
  });
});
