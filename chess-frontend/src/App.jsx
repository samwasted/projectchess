import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ChessGame from "./pages/ChessGame";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<ChessGame />} />
    </Routes>
  );
}

export default App;

