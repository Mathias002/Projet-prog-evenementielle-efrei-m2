import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from "../../socket";
import "./Game.css";

export default function Game() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const [room, setRoom] = useState(() => {
    if (navState) return navState;
    try {
      const stored = sessionStorage.getItem("currentRoom");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const myName = room?.myName;

  const [socketId, setSocketId] = useState(socket.id);
  const [gamePhase, setGamePhase] = useState("loading"); // loading, playing, results, end
  const [currentMusic, setCurrentMusic] = useState(null);
  const [scores, setScores] = useState(() => {
    const initialScores = {};
    if (room?.players) {
      Object.values(room.players).forEach((player) => {
        initialScores[player] = 0;
      });
    }
    return initialScores;
  });
  const [roundResults, setRoundResults] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timer, setTimer] = useState(15);
  const audioRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const [startCountdown, setStartCountdown] = useState(null);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    const onConnect = () => setSocketId(socket.id);
    const onDisconnect = () => setSocketId(null);
    if (socket.connected) onConnect();

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // L'hôte lance la séquence de jeu
  useEffect(() => {
    if (room?.roomCode && socketId && !gameStartedRef.current) {
      const amIHost = room.hostId === socketId;
      if (amIHost) {
        gameStartedRef.current = true; // Marque comme lancé
        console.log("Je suis l'hôte, je lance blindtest_game_start");
        socket.emit("blindtest_game_start", { roomCode: room.roomCode });
      }
    }
  }, [room?.roomCode, room?.hostId, socketId]);

  // Écouteurs d'événements du jeu
  useEffect(() => {
    const onMusic = (data) => {
      console.log("Nouvelle musique:", data);
      setCurrentMusic(data);
      setGamePhase("playing");
      setHasAnswered(false);
      setAnswer("");
      setRoundResults([]);
      setCorrectAnswer("");
      setTimer(15);

      if (audioRef.current) {
        audioRef.current.src = `http://localhost:3001${data.url}`;
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(e => console.error("Erreur lecture audio:", e));
      }

      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    };

    const onResult = (data) => {
      // Ignore les erreurs ou les résultats sans nom de joueur
      if (data.error || !data.playerName) return;

      setRoundResults(prev => {
        // Si le joueur est déjà affiché, on ne l'ajoute pas une seconde fois
        if (prev.some(res => res.playerName === data.playerName)) return prev;
        return [...prev, data];
      });
    };

    const onRoundEnd = (data) => {
      console.log("Fin du round:", data);
      setGamePhase("results");
      setCorrectAnswer(data.correctAnswer);
      setScores(data.scores);
    };

    const onGameEnd = (data) => {
      console.log("Fin de la partie:", data);
      setGamePhase("end");
      setScores(data.scores);
      setCurrentMusic(null);
      clearInterval(timerIntervalRef.current);
    };
    
    const onError = (data) => {
      alert(`Erreur du jeu: ${data.error}`);
      navigate('/lobby');
    };

    const onCountdown = (data) => {
      setStartCountdown(data.seconds);
      const interval = setInterval(() => {
        setStartCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    socket.on("blindtest_music", onMusic);
    socket.on("blindtest_result", onResult);
    socket.on("blindtest_round_end", onRoundEnd);
    socket.on("blindtest_game_end", onGameEnd);
    socket.on("blindtest_error", onError);
    socket.on("blindtest_countdown", onCountdown);

    return () => {
      socket.off("blindtest_music", onMusic);
      socket.off("blindtest_result", onResult);
      socket.off("blindtest_round_end", onRoundEnd);
      socket.off("blindtest_game_end", onGameEnd);
      socket.off("blindtest_error", onError);
      socket.off("blindtest_countdown", onCountdown);
      clearInterval(timerIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [navigate]);

  const submitAnswer = (e) => {
    e.preventDefault();
    if (!answer.trim() || hasAnswered) return;

    socket.emit("blindtest_answer", {
      roomCode: room.roomCode,
      playerName: myName,
      answer: answer,
    });
    setHasAnswered(true);
  };

  const returnToLobby = () => {
    navigate("/lobby");
  };

  const renderContent = () => {
    switch (gamePhase) {
      case "loading":
        return (
          <div className="game-phase-container">
            {startCountdown !== null ? (
              <>
                <h3>La partie commence dans...</h3>
                <div className="countdown-display">{startCountdown}</div>
              </>
            ) : (
              <h3>En attente du lancement...</h3>
            )}
          </div>
        );
      
      case "playing":
        return (
          <div className="game-phase-container playing-view">
            <h3>Devinez le titre de la musique !</h3>
            <form onSubmit={submitAnswer}>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Votre réponse..."
                disabled={hasAnswered}
                autoFocus
              />
              <button type="submit" disabled={hasAnswered}>
                {hasAnswered ? "Réponse envoyée !" : "Valider"}
              </button>
            </form>
          </div>
        );

      case "results":
        return (
          <div className="game-phase-container results-view">
            <h2>Résultats du round</h2>
            <p>La bonne réponse était : <strong>{correctAnswer}</strong></p>
            <ul>
              {roundResults.sort((a,b) => b.points - a.points).map((res, i) => (
                <li key={i} className={res.correct ? 'correct' : 'incorrect'}>
                  <span>{res.playerName}</span>
                  <span>{res.correct ? `+${res.points} points` : 'Mauvaise réponse'}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case "end":
        { const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
        return (
          <div className="game-phase-container end-screen">
            <h1>Partie terminée !</h1>
            <h2>Scores finaux</h2>
            <ol>
              {sortedScores.map(([name, score], index) => (
                <li key={name}>
                  <span>{index === 0 ? '🏆' : index + 1}. {name}</span>
                  <span>{score} points</span>
                </li>
              ))}
            </ol>
            <button onClick={returnToLobby}>Retourner au lobby</button>
          </div>
        ); }

      default:
        return null;
    }
  };

  return (
    <div className="game-page-layout">
      <audio ref={audioRef} />
      
      <div className="game-main-content">
        <div className="game-header">
          {currentMusic ? (
            <>
              <h1>Musique {currentMusic.index}/{currentMusic.total}</h1>
              <div className="timer">⏳ {timer}s</div>
            </>
          ) : (
            <h2>Blind Test</h2>
          )}
        </div>
        {renderContent()}
      </div>

      <aside className="scores-sidebar">
        <h2>Scores</h2>
        <ul>
          {Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([name, score]) => (
            <li key={name}>
              <span>{name}</span>
              <span>{score}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}