import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/HomePage/HomePage";
import Lobby from "./components/Lobby/Lobby";
import Game from "./components/Game/Game";

function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
      </Routes>
  );
}

export default App;
