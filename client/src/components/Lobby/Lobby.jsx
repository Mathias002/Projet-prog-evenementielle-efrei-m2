import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../../socket";

export default function Lobby() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [socketId, setSocketId] = useState(socket.id);
  const [isConnected, setIsConnected] = useState(socket.connected);
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

  // Force le re-rendu si le socket se connecte/déconnecte (pour mettre à jour socket.id)
  useEffect(() => {
    const onConnect = () => {
      setSocketId(socket.id);
      setIsConnected(true);
    };
    const onDisconnect = () => {
      setSocketId(null);
      setIsConnected(false);
    };
    
    // Si déjà connecté au montage, on met à jour l'ID immédiatement
    if (socket.connected) {
      setSocketId(socket.id);
      setIsConnected(true);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const startGame = () => {
    if (!room?.roomCode) return;
    
    // Émet l'événement pour lancer la partie
    socket.emit("start_game", { roomCode: room.roomCode });
    navigate("/game");
  };

  const toggleReady = () => {
    if (!room?.roomCode) return;
    console.log("Envoi de toggle_ready pour la room:", room.roomCode);
    if (!socket.connected) console.warn("⚠️ Socket déconnecté !");
    // Émet l'événement pour toggle l'état prêt
    socket.emit("toggle_ready", { roomCode: room.roomCode });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    // Tu peux ajouter un toast/notification ici
  };

  const leaveRoom = () => {
    if (room?.roomCode) {
      socket.emit("leave_room", room.roomCode);
    }
    sessionStorage.removeItem("currentRoom");
    navigate("/");
  };

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
      console.log("Mise à jour room reçue:", data);
      console.log("Mon socket ID:", socket.id);
      setRoom((prevRoom) => {
        const updated = {
          ...prevRoom,
          roomCode: data.roomCode || prevRoom?.roomCode,
          hostId: data.hostId || prevRoom?.hostId,
          players: data.players,
          readyPlayers: data.readyPlayers || {},
        };
        try {
          sessionStorage.setItem("currentRoom", JSON.stringify(updated));
        } catch (e) {
          /* ignore */
        }
        return updated;
      });
    };

    socket.on("room_updated", handler);
    return () => {
      socket.off("room_updated", handler);
    };
  }, []); // Retrait de [room, state] pour éviter les boucles de re-subscription

  // ✨ NOUVEAU: Écouter le démarrage de la partie
  useEffect(() => {
    const handler = (data) => {
      console.log("🎮 La partie commence !", data);
      // Navigate vers la page de jeu
      // navigate("/game", { state: { roomCode: data.roomCode, players: data.players } });
    };

    socket.on("game_started", handler);
    return () => {
      socket.off("game_started", handler);
    };
  }, [navigate]);

  // ✨ NOUVEAU: Gérer les réponses toggle_ready
  useEffect(() => {
    const handler = (response) => {
      console.log("Réponse toggle_ready reçue:", response);
      if (!response.success) {
        console.error("Erreur toggle ready:", response.error);
        if (response.error.code === "NOT_IN_ROOM" || response.error.code === "ROOM_NOT_FOUND") {
             alert("Vous avez été déconnecté de la salle (ou la salle n'existe plus).");
             sessionStorage.removeItem("currentRoom");
             navigate("/");
        }
      }
    };

    socket.on("toggle_ready_response", handler);
    return () => {
      socket.off("toggle_ready_response", handler);
    };
  }, []);

  // ✨ NOUVEAU: Gérer les réponses start_game
  useEffect(() => {
    const handler = (response) => {
      if (!response.success) {
        alert(response.error.message);
      }
    };

    socket.on("start_game_response", handler);
    return () => {
      socket.off("start_game_response", handler);
    };
  }, []);

  if (!room) {
    return (
      <div>
        <h1>Lobby</h1>
        <p>Aucune room sélectionnée.</p>
      </div>
    );
  }

  // Récupère les données des joueurs
  const players = Object.entries(room.players || {}).map(([socketId, name]) => ({
    socketId,
    name,
    isReady: room.readyPlayers?.[socketId] || false,
    isHost: room.hostId === socketId,
  }));

  // Calcule le nombre de joueurs prêts
  const readyCount = players.filter((p) => p.isReady).length;
  const totalPlayers = players.length;
  const allReady = readyCount === totalPlayers && totalPlayers > 0;

  // Détermine si le joueur actuel est prêt
  const currentPlayerReady = room.readyPlayers?.[socketId] || room.readyPlayers?.[socket.id] || false;
  const amIHost = room.hostId === socketId;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header avec code de la room */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎮 Lobby
            {!isConnected && (
              <span style={{ fontSize: '0.5em', color: 'red', marginLeft: '10px' }}>
                (Déconnecté)
              </span>
            )}
          </h1>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <span style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Code de la room
          </span>
          <span style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: '700',
            letterSpacing: '3px',
            fontFamily: 'monospace'
          }}>
            {room.roomCode}
          </span>
          <button
            onClick={copyRoomCode}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            📋 Copier
          </button>
        </div>
      </header>

      {/* Conteneur principal avec sidebar */}
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 85px)',
        gap: '0'
      }}>
        {/* Section centrale - Lancement de partie */}
        <main style={{
          flex: 1,
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '40px',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
            }}>
              {allReady ? '🚀' : '🎯'}
            </div>

            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '32px',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              {allReady ? 'C\'est parti !' : 'Prêt à jouer ?'}
            </h2>

            <p style={{
              margin: '0 0 32px 0',
              fontSize: '16px',
              color: '#6b7280',
              lineHeight: '1.6'
            }}>
              {allReady 
                ? 'Tous les joueurs sont prêts ! Vous pouvez lancer la partie.'
                : 'En attente que tous les joueurs soient prêts pour commencer la partie'}
            </p>

            {/* Barre de progression des joueurs prêts */}
            <div style={{
              background: '#f3f4f6',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '32px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Joueurs prêts
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: allReady ? '#10b981' : '#667eea'
                }}>
                  {readyCount}/{totalPlayers}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(readyCount / totalPlayers) * 100}%`,
                  height: '100%',
                  background: allReady 
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'all 0.3s ease'
                }} />
              </div>
            </div>

            {/* Boutons d'action */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexDirection: 'column'
            }}>
              <button
                onClick={toggleReady}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: currentPlayerReady ? '#667eea' : 'white',
                  background: currentPlayerReady ? 'white' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: currentPlayerReady ? '2px solid #667eea' : 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: currentPlayerReady ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  if (!currentPlayerReady) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!currentPlayerReady) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                  }
                }}
              >
                {currentPlayerReady ? '✓ Prêt !' : '👍 Je suis prêt'}
              </button>

              <button
                onClick={startGame}
                disabled={!allReady || !amIHost}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  background: allReady && amIHost
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : '#d1d5db',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: allReady && amIHost ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  opacity: allReady && amIHost ? 1 : 0.5,
                  boxShadow: allReady && amIHost ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (allReady && amIHost) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (allReady && amIHost) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                🚀 Lancer la partie
              </button>
            </div>

            <p style={{
              margin: '24px 0 0 0',
              fontSize: '13px',
              color: '#9ca3af'
            }}>
              {amIHost 
                ? "💡 Vous êtes l'hôte. Lancez la partie quand tout le monde est prêt !" 
                : "💡 Astuce : Partagez le code de la room avec vos amis !"}
            </p>
          </div>
        </main>

        {/* Sidebar droite - Liste des joueurs */}
        <aside style={{
          width: '320px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid rgba(102, 126, 234, 0.1)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header de la sidebar */}
          <div style={{
            padding: '24px',
            borderBottom: '2px solid #f3f4f6'
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              👥 Joueurs
            </h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {totalPlayers} {totalPlayers > 1 ? 'joueurs' : 'joueur'} dans la room
            </p>
          </div>

          {/* Liste des joueurs */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px'
          }}>
            {players.map((player, index) => (
              <div
                key={player.socketId}
                style={{
                  background: player.isHost 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                    : '#f9fafb',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: player.isHost ? '2px solid #667eea' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: player.isHost
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>

                {/* Info joueur */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#1f2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {player.name}
                  </div>
                  {player.isHost && (
                    <div style={{
                      fontSize: '12px',
                      color: '#667eea',
                      fontWeight: '600',
                      marginTop: '2px'
                    }}>
                      👑 Hôte
                    </div>
                  )}
                </div>

                {/* Status indicator - UPDATED avec état prêt */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {player.isReady && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      ✓ Prêt
                    </span>
                  )}
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: player.isReady ? '#10b981' : '#fbbf24',
                    boxShadow: player.isReady 
                      ? '0 0 8px rgba(16, 185, 129, 0.6)'
                      : '0 0 8px rgba(251, 191, 36, 0.6)',
                    flexShrink: 0
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer de la sidebar */}
          <div style={{
            padding: '16px 24px',
            borderTop: '2px solid #f3f4f6',
            background: '#fafafa'
          }}>
            <button
              onClick={leaveRoom}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#dc2626',
                background: 'white',
                border: '2px solid #fecaca',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#fef2f2';
                e.target.style.borderColor = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.borderColor = '#fecaca';
              }}
            >
              🚪 Quitter la room
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}