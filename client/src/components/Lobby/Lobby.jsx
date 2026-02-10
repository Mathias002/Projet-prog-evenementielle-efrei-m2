import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../../socket";

export default function Lobby() {
  const { state } = useLocation();

  const [room, setRoom] = useState(() => {
    // prefer the navigation state, otherwise try sessionStorage
    if (state) return state;
    try {
      const stored = sessionStorage.getItem("currentRoom");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  // when we receive initial navigation state, persist it and set local state
  useEffect(() => {
    if (state) {
      try {
        sessionStorage.setItem("currentRoom", JSON.stringify(state));
      } catch (e) {
        /* ignore */
      }
      setRoom(state);
    }
  }, [state]);

  // listen for live updates from the server
  useEffect(() => {
    const handler = (data) => {
      // data is expected to contain { players: { socketId: name, ... }, roomCode? }
      const roomCode =
        data.roomCode || room?.roomCode || state?.roomCode || null;
      const updated = {
        roomCode,
        players: data.players,
      };
      setRoom(updated);
      try {
        sessionStorage.setItem("currentRoom", JSON.stringify(updated));
      } catch (e) {
        /* ignore */
      }
    };

    socket.on("room_updated", handler);
    return () => {
      socket.off("room_updated", handler);
    };
  }, [room, state]);

  if (!room) {
    return (
      <div>
        <h1>Lobby</h1>
        <p>Aucune room sélectionnée.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Lobby</h1>
      <p>
        Code de la room : <strong>{room.roomCode}</strong>
      </p>

      <h3>Joueurs :</h3>
      <ul>
        {Object.values(room.players || {}).map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
