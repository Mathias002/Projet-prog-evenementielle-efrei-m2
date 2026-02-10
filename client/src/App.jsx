import { useEffect, useState } from "react";
import { io } from "socket.io-client";

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
    <div style={{ padding: 40 }}>
      <h1>Blindtest 🎵</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;
