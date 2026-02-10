import { useState } from "react";
import { socket } from "../../socket";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createRoom = () => {
    setError(null);
    socket.emit("create_room", { playerName });
  };

   const joinRoom = () => {
    console.log("join");
    console.log(roomName);
    console.log(playerName);
      setError(null);
      socket.emit("join_room", { roomName, playerName });
    };

  socket.off("create_room_response").on(
    "create_room_response",
    (response) => {
      if (!response.success) {
        setError(response.error.message);
        return;
      }

      navigate("/lobby", {
        state: response.data,
      });
    }
  );

  return (
    <div>
      <h1>Créer une room</h1>

      <input
        placeholder="Ton pseudo"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />

      <button onClick={createRoom}>Créer</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h1>Rejoindre une room</h1>

      <input
        placeholder="Code de la room"
        value={roomName}
        onChange={(l) => setRoomName(l.target.value)}
      />

      <button onClick={joinRoom}>Rejoindre</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
    
  );
}
