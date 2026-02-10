import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

export const Homepage = () => {
  const navigate = useNavigate();

  const handleJoin = () => {
    // Génère un ID aléatoire simple pour le lobby (ex: "lobby-xyz123")
    const randomLobbyId = Math.random().toString(36).substring(2, 9);
    navigate(`/lobby/${randomLobbyId}`);
  };

  return (
    <div className="homepage-container">
      <h1 className="game-title">Blind Test Party</h1>
      <div className="join-section">
        <p>Bienvenue ! Rejoignez le salon pour commencer à jouer.</p>
        <button className="btn-primary join-btn" onClick={handleJoin}>
          Rejoindre le Lobby
        </button>
      </div>
    </div>
  );
};
