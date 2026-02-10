import { useLocation } from "react-router-dom";

export default function Lobby() {
  const { state } = useLocation();

  return (
    <div>
      <h1>Lobby</h1>
      <p>Code de la room : <strong>{state.roomCode}</strong></p>

      <h3>Joueurs :</h3>
      <ul>
        {Object.values(state.players).map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
