import { useState } from 'react';
import { useParams } from 'react-router-dom';
import './Lobby.css';

export const Lobby = () => {
  const { lobbyId } = useParams();

  // État pour savoir si l'utilisateur courant est prêt
  const [isReady, setIsReady] = useState(false);

  // Données simulées des participants (à remplacer par les données venant de votre backend/socket)
  const [participants, setParticipants] = useState([
    { id: 1, name: 'Moi', score: 0, isReady: false, isCurrentUser: true },
    { id: 2, name: 'Alice', score: 120, isReady: true, isCurrentUser: false },
    { id: 3, name: 'Bob', score: 80, isReady: false, isCurrentUser: false },
    { id: 4, name: 'Charlie', score: 250, isReady: true, isCurrentUser: false },
  ]);

  // Fonction pour changer son statut "Prêt"
  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    
    // Mise à jour locale pour l'exemple (à gérer via le serveur normalement)
    setParticipants(prev => prev.map(p => 
      p.isCurrentUser ? { ...p, isReady: newReadyState } : p
    ));
    
    // Ici, socket.emit('player_ready', newReadyState)
  };

  return (
    <div className="lobby-container">
      {/* Zone Principale (Gauche/Centre) */}
      <div className="main-area">
        <h1 className="game-title">Blind Test Party</h1>
        <p>Salon ID : {lobbyId}</p>
        
          <div className="lobby-section">
            <h2>En attente des joueurs...</h2>
            <p>Mettez-vous prêt pour lancer la partie !</p>
            
            <button 
              className={`btn-primary ready-btn ${isReady ? 'is-ready' : ''}`} 
              onClick={toggleReady}
            >
              {isReady ? 'ANNULER' : 'JE SUIS PRÊT !'}
            </button>

            <div className="ready-status-list">
              <h3>Statut des joueurs :</h3>
              <ul>
                {participants.map(user => (
                  <li key={user.id} className={user.isReady ? 'status-ready' : 'status-waiting'}>
                    {user.name} : {user.isReady ? '✅ Prêt' : '⏳ En attente'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
      </div>

      {/* Barre Latérale (Droite) - Participants et Scores */}
      <div className="sidebar-right">
        <div className="sidebar-header">
          <h3>Participants ({participants.length})</h3>
        </div>
        <ul className="participants-list">
          {participants
            .sort((a, b) => b.score - a.score) // Tri par score décroissant
            .map((user) => (
            <li key={user.id} className={`participant-card ${user.isCurrentUser ? 'current-user' : ''}`}>
              <div className="participant-info">
                <span className="participant-name">{user.name}</span>
                <span className="participant-status-dot" style={{backgroundColor: user.isReady ? '#4caf50' : '#ff9800'}}></span>
              </div>
              <span className="participant-score">{user.score} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
