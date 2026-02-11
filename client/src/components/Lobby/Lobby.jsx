import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from "../../socket";

export default function Lobby() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

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

  const startGame = () => {
    console.log('Starting game...');
  };

   const players = Object.values(room.players || {});

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
              🎯
            </div>

            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '32px',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              Prêt à jouer ?
            </h2>

            <p style={{
              margin: '0 0 32px 0',
              fontSize: '16px',
              color: '#6b7280',
              lineHeight: '1.6'
            }}>
              En attente que tous les joueurs soient prêts pour commencer la partie
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
                  color: '#667eea'
                }}>
                  {isReady ? 1 : 0}/{players.length}
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
                  width: `${(isReady ? 1 : 0) / players.length * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s ease'
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
                onClick={() => setIsReady(!isReady)}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: isReady ? '#667eea' : 'white',
                  background: isReady ? 'white' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: isReady ? '2px solid #667eea' : 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isReady ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  if (!isReady) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isReady) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                  }
                }}
              >
                {isReady ? '✓ Prêt !' : '👍 Je suis prêt'}
              </button>

              <button
                onClick={startGame}
                disabled={!isReady}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  background: isReady 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : '#d1d5db',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isReady ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  opacity: isReady ? 1 : 0.5,
                  boxShadow: isReady ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (isReady) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isReady) {
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
              💡 Astuce : Partagez le code de la room avec vos amis !
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
              {players.length} {players.length > 1 ? 'joueurs' : 'joueur'} dans la room
            </p>
          </div>

          {/* Liste des joueurs */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px'
          }}>
            {players.map((name, index) => (
              <div
                key={name}
                style={{
                  background: index === 0 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                    : '#f9fafb',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: index === 0 ? '2px solid #667eea' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: index === 0
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
                  {name.charAt(0).toUpperCase()}
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
                    {name}
                  </div>
                  {index === 0 && (
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

                {/* Status indicator */}
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                  flexShrink: 0
                }} />
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
