import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Handle create room responses
    socket
      .off("create_room_response")
      .on("create_room_response", (response) => {
        if (!response.success) {
          setError(response.error.message);
          return;
        }

        // store initial room state so Lobby can access it if needed
        try {
          sessionStorage.setItem("currentRoom", JSON.stringify(response.data));
        } catch (e) {
          // ignore storage errors
        }

        navigate("/lobby", {
          state: response.data,
        });
      });

    // Handle join room responses (navigate to lobby on success)
    socket.off("join_room_response").on("join_room_response", (response) => {
      if (!response.success) {
        setError(response.error.message);
        return;
      }

      try {
        sessionStorage.setItem("currentRoom", JSON.stringify(response.data));
      } catch (e) {
        // ignore storage errors
      }

      navigate("/lobby", {
        state: response.data,
      });
    });

    // Keep a local cache of the room state so the Lobby page can pick up updates
    // when it mounts (we write updates to sessionStorage)
    socket.off("room_updated").on("room_updated", (data) => {
      // data expected to be { players: { socketId: name, ... }, ... }
      // Try to preserve roomCode if it's not included in the payload
      let roomCode =
        data.roomCode ||
        JSON.parse(sessionStorage.getItem("currentRoom") || "null")?.roomCode;
      if (!roomCode) {
        // nothing to do if we don't know the room code
        return;
      }

      const updated = {
        roomCode,
        players: data.players,
      };

      try {
        sessionStorage.setItem("currentRoom", JSON.stringify(updated));
      } catch (e) {
        // ignore storage errors
      }
    });

    // cleanup on unmount
    return () => {
      socket.off("create_room_response");
      socket.off("join_room_response");
      socket.off("room_updated");
    };
  }, [navigate]);

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
        onChange={(e) => setRoomName(e.target.value)}
      />

      <button onClick={joinRoom}>Rejoindre</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
