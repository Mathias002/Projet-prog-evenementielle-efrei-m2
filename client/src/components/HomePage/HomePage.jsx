import { useState, useEffect } from "react";
import { socket } from "../../socket";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('create');
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        width: '100%',
        maxWidth: '480px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '32px 24px',
          textAlign: 'center'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '700',
            color: 'white',
            letterSpacing: '-0.5px'
          }}>
            🎮 Rejoindre la partie
          </h1>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #f0f0f0',
          background: '#fafafa'
        }}>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: activeTab === 'create' ? 'white' : 'transparent',
              color: activeTab === 'create' ? '#667eea' : '#6b7280',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              borderBottom: activeTab === 'create' ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s ease',
              position: 'relative',
              top: '2px'
            }}
          >
            Créer une room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            style={{
              flex: 1,
              padding: '16px',
              border: 'none',
              background: activeTab === 'join' ? 'white' : 'transparent',
              color: activeTab === 'join' ? '#667eea' : '#6b7280',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              borderBottom: activeTab === 'join' ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s ease',
              position: 'relative',
              top: '2px'
            }}
          >
            Rejoindre
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 24px' }}>
          {activeTab === 'create' ? (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Ton pseudo
                </label>
                <input
                  type="text"
                  placeholder="Entrer ton pseudo"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button
                onClick={createRoom}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
              >
                🚀 Créer la room
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Ton pseudo
                </label>
                <input
                  type="text"
                  placeholder="Entrer ton pseudo"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Code de la room
                </label>
                <input
                  type="text"
                  placeholder="ex: ABCD1234"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button
                onClick={joinRoom}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
              >
                🎯 Rejoindre la partie
              </button>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
