import React from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  // Preload the ChessGame component when hovering over the button
  const preloadPlayPage = () => {
    import("./ChessGame");
  };

  return (
    <div className="text-center p-12">
      <h1 className="text-4xl font-bold mb-8">Welcome to Chess Game</h1>
      <button
        onMouseEnter={preloadPlayPage}
        onClick={() => navigate("/play")}
        className="px-5 py-2 text-lg cursor-pointer bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Play Chess
      </button>
    </div>
  );
}

export default Home;
