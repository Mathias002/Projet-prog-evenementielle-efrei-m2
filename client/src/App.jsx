import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/HomePage/HomePage";
import Lobby from "./components/Lobby/Lobby";

function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
      </Routes>
  );
}

export default App;
