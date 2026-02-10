import { useState } from "react";
import { socket } from "../../socket";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createRoom = () => {
    setError(null);
    socket.emit("create_room", { playerName });
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
    </div>
  );
}
