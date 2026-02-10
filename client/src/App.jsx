import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Routes, Route, Navigate } from "react-router-dom";
import { Lobby } from "./components/Lobby/Lobby";
import { Homepage } from "./components/HomePage/HomePage";

const socket = io("http://localhost:3001");

function App() {
  const [status, setStatus] = useState("Connexion...");

  useEffect(() => {
    socket.on("connect", () => {
      setStatus("🟢 Connecté au serveur");
    });

    socket.on("connected", (data) => {
      console.log("Socket ID :", data.socketId);
    });

    return () => {
      socket.off("connect");
      socket.off("connected");
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Homepage />} />
        <Route path="/lobby/:lobbyId" element={<Lobby socket={socket} />} />
      </Routes>
    </div>
  );
}

export default App;
