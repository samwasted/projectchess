import React, { useState, useEffect, useCallback, useRef } from 'react';
// For chess.js v1.0.0+, import needs to be changed to handle the default export
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';

const SOCKET_URL = "http://localhost:8080/ws";

const ChessGame = () => {
  console.log("ChessGame component initialized");
  
  // Board square colors.
  const darkSquareColor = "#B58863";
  const lightSquareColor = "#F0D9B5";

  // Local game state - update the initialization for chess.js v1.0.0+
  const [game, setGame] = useState(() => new Chess());
  const [moveLog, setMoveLog] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [gameStatus, setGameStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Multiplayer state.
  const [client, setClient] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [playerColor, setPlayerColor] = useState(null); // 'w' or 'b'
  const [systemMessage, setSystemMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [opponent, setOpponent] = useState(null);

  // UI state for player name modal.
  const [showNameModal, setShowNameModal] = useState(true);
  const [nameInput, setNameInput] = useState("");

  // Responsive layout state.
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Ref for auto-scrolling move log.
  const moveListRef = useRef(null);

  // Function to check if it's the player's turn (defined early to avoid reference issues)
  const isPlayerTurn = useCallback(() => {
    if (!connected) {
      console.log("Not connected, cannot make move");
      setSystemMessage("You must be connected to a game to make moves");
      return false;
    }
    if (!playerColor) {
      console.log("No color assigned, cannot make move");
      setSystemMessage("Waiting for game to assign you a color");
      return false;
    }
    if (game.turn() !== playerColor) {
      console.log(`Not player's turn. Current turn: ${game.turn()}, Player: ${playerColor}`);
      setSystemMessage(`It's not your turn. ${game.turn() === 'w' ? 'White' : 'Black'} to move.`);
      return false;
    }
    console.log("Player's turn confirmed");
    return true;
  }, [connected, playerColor, game]);

  // Update game status display.
  const updateGameStatus = useCallback((currentGame) => {
    let status = "";
    if (currentGame.isGameOver()) {
      if (currentGame.isCheckmate()) {
        const winner = currentGame.turn() === 'w' ? 'Black' : 'White';
        status = `Checkmate! ${winner} wins!`;
      } else if (currentGame.isStalemate()) {
        status = 'Stalemate! Game ends in a draw.';
      } else if (currentGame.isDraw()) {
        status = 'Draw! Game over.';
      } else {
        status = 'Game Over!';
      }
    } else if (currentGame.inCheck()) {
      status = `${currentGame.turn() === 'w' ? 'White' : 'Black'} is in check!`;
    } else {
      status = currentGame.turn() === 'w' ? 'White to move' : 'Black to move';
    }
    console.log("Game status updated:", status);
    setGameStatus(status);
  }, []);

  // Add move to history.
  const addMoveToHistory = useCallback((move) => {
    const playerLabel = game.turn() === 'b' ? 'White' : 'Black';
    const moveNotation = `${playerLabel}: ${move.san}`;
    console.log("Adding move to history:", moveNotation);
    setMoveLog(prev => [...prev, moveNotation]);
  }, [game]);

  // Handle window resize.
  useEffect(() => {
    console.log("Setting up window resize listener");
    const handleResize = () => {
      const newWidth = window.innerWidth;
      console.log(`Window resized to ${newWidth}px`);
      setWindowWidth(newWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      console.log("Cleaning up window resize listener");
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Fetch initial game state on component mount
  useEffect(() => {
    console.log("Fetching initial game state");
    setIsLoading(true);
    axios.get(`http://localhost:8080/chess`)
      .then(response => {
        console.log("GET /chess response:", response.data);
        const { fen, moveHistory } = response.data;
        try {
          if (fen && fen.trim().length > 0) {
            console.log("Valid FEN received:", fen);
            // For chess.js v1.0.0+, use try-catch for loading FEN
            try {
              const newGame = new Chess();
              newGame.load(fen);
              setGame(newGame);
              updateGameStatus(newGame);
            } catch (fenErr) {
              console.error("Error loading FEN:", fenErr);
              setError(`Invalid FEN received: ${fenErr.message}. Starting a new game.`);
              const newGame = new Chess();
              setGame(newGame);
            }
          } else {
            console.log("No FEN received, starting new game");
            const newGame = new Chess();
            setGame(newGame);
            updateGameStatus(newGame);
          }
          setMoveLog(moveHistory || []);
          console.log("Move history set:", moveHistory || []);
        } catch (err) {
          console.error("Error parsing game state:", err);
          setError("Invalid game state received. Starting a new game.");
          const newGame = new Chess();
          setGame(newGame);
          setMoveLog([]);
        }
      })
      .catch(err => {
        console.error("Error fetching game state:", err);
        setError("Failed to connect to the game server. Playing in offline mode.");
        const newGame = new Chess();
        setGame(newGame);
        setMoveLog([]);
      })
      .finally(() => {
        setIsLoading(false);
        console.log("Initial game state loading completed");
      });
  }, [updateGameStatus]);

  // Initialize WebSocket client when playerName is set.
  const initializeClient = useCallback(() => {
    if (!playerName) {
      console.log("No player name set, skipping client initialization");
      return null;
    }
    
    console.log("Initializing WebSocket client for player:", playerName);
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      debug: process.env.NODE_ENV === 'development' ? (msg) => console.log(msg) : null,
    });

    stompClient.onConnect = () => {
      console.log("Connected to WebSocket");
      setConnected(true);
      setSystemMessage("Connected! Waiting for opponent...");
      
      // Send join message.
      const joinMessage = { player: playerName };
      console.log("Sending join message:", joinMessage);
      stompClient.publish({
        destination: '/app/chess.join',
        body: JSON.stringify(joinMessage),
      });
    
      // Subscribe to the main chess topic for initial subscription notification
      stompClient.subscribe('/topic/chess', (message) => {
        console.log("Received message from main topic:", message.body);
        try {
          const update = JSON.parse(message.body);
          console.log("Parsed main topic update:", update);
          
          // Handle subscription notification
          if (update.type === "game.subscribe" && update.gameId) {
            setGameId(update.gameId);
            console.log("Game ID received, subscribing to game-specific topic:", update.gameId);
            
            // Subscribe to the game-specific topic
            stompClient.subscribe(`/topic/chess.${update.gameId}`, (gameMessage) => {
              console.log("Received message from game topic:", gameMessage.body);
              try {
                const gameUpdate = JSON.parse(gameMessage.body);
                console.log("Parsed game update:", gameUpdate);
                
                // Handle different message types
                if (gameUpdate.type === "game.joined") {
                  handleGameJoined(gameUpdate);
                } else if (gameUpdate.type === "game.move") {
                  handleGameMove(gameUpdate);
                } else if (gameUpdate.type === "game.gameOver") {
                  handleGameOver(gameUpdate);
                } else if (gameUpdate.type === "game.left") {
                  handleGameLeft(gameUpdate);
                } else if (gameUpdate.type === "system") {
                  console.log("System message:", gameUpdate.content);
                  setSystemMessage(gameUpdate.content);
                  setTimeout(() => {
                    setSystemMessage(prev => prev === gameUpdate.content ? "" : prev);
                  }, 5000);
                } else if (gameUpdate.type === "error") {
                  console.error("Error from server:", gameUpdate.content);
                  setError(gameUpdate.content);
                  setTimeout(() => {
                    setError("");
                  }, 5000);
                }
              } catch (err) {
                console.error("Error parsing game message:", err);
              }
            });
          }
        } catch (err) {
          console.error("Error parsing main topic message:", err);
        }
      });
    };

    stompClient.onStompError = (frame) => {
      console.error("Broker error:", frame.headers['message'], frame.body);
      setSystemMessage("Connection error: " + frame.headers['message']);
    };

    stompClient.onWebSocketClose = () => {
      console.log("WebSocket connection closed");
      setConnected(false);
      setSystemMessage("Disconnected from game server. Attempting to reconnect...");
    };
    
    return stompClient;
  }, [playerName]);

  // Handle game joined message
  const handleGameJoined = useCallback((update) => {
    // Determine player colors based on your player name
    if (update.player1 === playerName) {
      setPlayerColor('w');  // Player 1 is white
      console.log("You are Player 1 (White)");
      setSystemMessage("You are playing as White");
      if (update.player2) {
        setOpponent(update.player2);
        console.log("Opponent (Black):", update.player2);
      }
    } else if (update.player2 === playerName) {
      setPlayerColor('b');  // Player 2 is black
      console.log("You are Player 2 (Black)");
      setSystemMessage("You are playing as Black");
      if (update.player1) {
        setOpponent(update.player1);
        console.log("Opponent (White):", update.player1);
      }
    }

    // Update board state if provided
    if (update.board) {
      try {
        // Convert board array to FEN or however your backend represents the board
        // This depends on your specific implementation
        console.log("Received board state:", update.board);
        
        // If you're using FEN strings directly:
        // const newGame = new Chess(update.board);
        
        // Or if you need to convert the board array to a format Chess.js understands:
        // const newGame = convertBoardToChess(update.board);
        
        // For this example, I'll assume we're starting a new game
        const newGame = new Chess();
        setGame(newGame);
        updateGameStatus(newGame);
      } catch (err) {
        console.error("Error updating board state:", err);
      }
    }

    // Update game state
    if (update.gameState) {
      console.log("Game state:", update.gameState);
      if (update.gameState === "IN_PROGRESS") {
        setSystemMessage(`Game in progress. ${update.turn === playerName ? "Your" : "Opponent's"} turn.`);
      } else if (update.gameState === "WAITING_FOR_PLAYER") {
        setSystemMessage("Waiting for another player to join...");
      }
    }
  }, [playerName, updateGameStatus]);

  // Handle game move message
  const handleGameMove = useCallback((update) => {
    console.log("Move update received:", update);
    
    // Update the chess board
    if (update.board) {
      try {
        // Here you would convert your board representation to something Chess.js understands
        // For simplicity, I'll reset to a new game (you'll need to adapt this)
        const newGame = new Chess();
        // newGame.load(boardToFen(update.board)); // You'll need to implement this conversion
        setGame(newGame);
        updateGameStatus(newGame);
        
        // You might also want to add the move to the move log
        if (update.move) {
          const moveNotation = `${update.sender}: ${update.move}`;
          setMoveLog(prev => [...prev, moveNotation]);
        }
      } catch (err) {
        console.error("Error updating board after move:", err);
      }
    }
    
    // Update whose turn it is
    if (update.turn) {
      const isYourTurn = update.turn === playerName;
      setSystemMessage(isYourTurn ? "Your turn" : `${update.turn}'s turn`);
    }
  }, [playerName, updateGameStatus]);

  // Handle game over message
  const handleGameOver = useCallback((update) => {
    console.log("Game over update received:", update);
    
    if (update.gameState) {
      let statusMessage = "Game Over!";
      
      if (update.gameState === "PLAYER1_WON") {
        statusMessage = `${update.player1} (White) wins!`;
      } else if (update.gameState === "PLAYER2_WON") {
        statusMessage = `${update.player2} (Black) wins!`;
      } else if (update.gameState === "DRAW") {
        statusMessage = "Game ended in a draw!";
      }
      
      setGameStatus(statusMessage);
      setSystemMessage(statusMessage);
    }
    
    if (update.winner) {
      console.log("Winner:", update.winner);
      const youWon = update.winner === playerName;
      setSystemMessage(youWon ? "You won the game!" : `${update.winner} won the game!`);
    }
  }, [playerName]);

  // Handle game left message
  const handleGameLeft = useCallback((update) => {
    console.log("Player left update received:", update);
    
    // Check if opponent left
    if ((update.player1 === null && playerName === update.player2) || 
        (update.player2 === null && playerName === update.player1)) {
      setOpponent(null);
      setSystemMessage("Your opponent left the game. Waiting for a new player...");
    }
    
    // Reset game if both players left
    if (update.player1 === null && update.player2 === null) {
      setGameId(null);
      setPlayerColor(null);
      setOpponent(null);
      setGame(new Chess());
      setMoveLog([]);
      setSystemMessage("Game ended. Join again to start a new game.");
    }
  }, [playerName]);

  // Establish WebSocket connection once playerName is set.
  useEffect(() => {
    if (!playerName) {
      console.log("No player name set, skipping WebSocket connection");
      return;
    }
    
    console.log("Establishing WebSocket connection for player:", playerName);
    setSystemMessage("Connecting to game server...");
    const stompClient = initializeClient();
    
    if (stompClient) {
      stompClient.activate();
      setClient(stompClient);
      console.log("WebSocket client activated");
    }
    
    return () => {
      if (stompClient) {
        if (stompClient.active && gameId) {
          const leaveMessage = { 
            player: playerName 
          };
          console.log("Sending leave message:", leaveMessage);
          stompClient.publish({
            destination: '/app/chess.leave',
            body: JSON.stringify(leaveMessage),
          });
        }
        stompClient.deactivate();
        console.log("WebSocket client deactivated");
      }
    };
  }, [playerName, initializeClient, gameId]);

  // Auto-scroll move log.
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
      console.log("Move log scrolled to bottom");
    }
  }, [moveLog]);

  // Handle manual move input.
  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      console.log("Empty move input, ignoring submission");
      return false;
    }
    
    if (!isPlayerTurn()) {
      console.log("Not player's turn, ignoring move");
      return false;
    }
    
    try {
      console.log("Attempting manual move:", inputValue);
      const move = game.move(inputValue);
      if (!move) {
        console.log("Invalid move:", inputValue);
        setSystemMessage("Invalid move");
        return false;
      }
      console.log("Valid move executed:", move);
      const newFen = game.fen();
      console.log("New FEN:", newFen);
      const newGame = new Chess();
      newGame.load(newFen);
      setGame(newGame);
      addMoveToHistory(move);
      updateGameStatus(newGame);
      setInputValue("");
      
      if (client && client.active && gameId) {
        const moveMessage = {
          gameId: gameId,
          sender: playerName,
          move: inputValue,  // Changed from move.san to match backend expectations
        };
        console.log("Publishing move message:", moveMessage);
        client.publish({
          destination: '/app/chess.move',
          body: JSON.stringify(moveMessage),
        });
      }
      return true;
    } catch (error) {
      console.error("Error processing manual move:", error);
      setSystemMessage(`Error: ${error.message}`);
      return false;
    }
  }, [game, inputValue, client, gameId, playerName, isPlayerTurn, addMoveToHistory, updateGameStatus]);

  // Handle drag-and-drop moves.
  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    console.log(`Attempting to move from ${sourceSquare} to ${targetSquare}`);
    if (!isPlayerTurn()) {
      console.log("Not player's turn, ignoring drag move");
      return false;
    }
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });
      
      if (move) {
        console.log("Valid drag move executed:", move);
        const newFen = game.fen();
        console.log("New FEN:", newFen);
        const newGame = new Chess();
        newGame.load(newFen);
        setGame(newGame);
        addMoveToHistory(move);
        updateGameStatus(newGame);
        
        if (client && client.active && gameId) {
          const moveMessage = {
            gameId: gameId,
            sender: playerName,
            move: `${sourceSquare}${targetSquare}`,  // Using simple notation for backend
          };
          console.log("Publishing move message from onPieceDrop:", moveMessage);
          client.publish({
            destination: '/app/chess.move',
            body: JSON.stringify(moveMessage),
          });
        }
        return true;
      }
      console.log("Invalid drag move");
      return false;
    } catch (error) {
      console.error("Error in onPieceDrop:", error);
      setSystemMessage(`Error: ${error.message}`);
      return false;
    }
  }, [game, client, gameId, playerName, isPlayerTurn, addMoveToHistory, updateGameStatus]);

  // Reset game handler
  const resetGame = useCallback(() => {
    console.log("Resetting game");
    if (!window.confirm("Are you sure you want to start a new game?")) {
      console.log("New game cancelled by user");
      return;
    }
    
    if (client && client.active && gameId) {
      // Note: Your backend doesn't seem to have a chess.reset endpoint
      // You might want to leave the game and join a new one instead
      leaveGame();
    } else {
      console.log("Resetting local game");
      const newGame = new Chess();
      setGame(newGame);
      setMoveLog([]);
      updateGameStatus(newGame);
    }
  }, [client, gameId, updateGameStatus]);

  // Leave game handler.
  const leaveGame = useCallback(() => {
    if (!window.confirm("Are you sure you want to leave the game?")) {
      console.log("Leave game cancelled by user");
      return;
    }
    console.log("Player leaving game");
    if (client && client.active && gameId) {
      const leaveMessage = { player: playerName };
      console.log("Publishing leave message:", leaveMessage);
      client.publish({
        destination: '/app/chess.leave',
        body: JSON.stringify(leaveMessage),
      });
      setGameId(null);
      setPlayerColor(null);
      setOpponent(null);
      setGame(new Chess());
      setMoveLog([]);
      setSystemMessage("You left the game. Join again to find a new opponent.");
      setShowNameModal(true);
      setNameInput(playerName);
      setPlayerName("");
    }
  }, [client, gameId, playerName]);

  // Fixed: correctly implement the piece draggability function for react-chessboard
  const isDraggablePiece = useCallback(({ piece }) => {
    if (!connected || !playerColor) return false;
    const pieceColor = piece.charAt(0).toLowerCase();
    return pieceColor === playerColor && game.turn() === playerColor;
  }, [connected, playerColor, game]);

  // Inline styles.
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    display: 'flex',
    gap: '20px',
    flexDirection: windowWidth < 768 ? 'column' : 'row',
  };
  const boardContainerStyle = {
    flex: 2,
    maxWidth: '600px',
  };
  const moveLogStyle = {
    flex: 1,
    border: '1px solid #eee',
    padding: '10px',
    borderRadius: '5px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  };
  const moveListStyle = {
    height: '400px',
    overflowY: 'auto',
    border: '1px solid #eee',
    padding: '10px',
    borderRadius: '5px',
  };
  const moveItemStyle = (index) => ({
    padding: '5px',
    borderBottom: '1px solid #eee',
    backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white',
  });
  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '15px',
    marginRight: '10px',
  };
  const leaveButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#f44336',
  };
  const statusStyle = {
    fontSize: '20px',
    marginBottom: '15px',
    color: gameStatus.includes('Check') ? '#d32f2f' : gameStatus.includes('wins') ? '#4caf50' : '#333',
    fontWeight: 'bold',
  };
  const systemMessageStyle = {
    padding: '10px',
    marginBottom: '10px',
    color: '#ff5722',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: '5px',
    display: systemMessage ? 'block' : 'none',
  };
  const errorMessageStyle = {
    padding: '10px',
    marginBottom: '10px',
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#d32f2f',
    borderRadius: '5px',
    display: error && error.trim() !== "" ? 'block' : 'none',
  };
  const formStyle = {
    display: 'flex',
    marginTop: '10px',
    gap: '10px',
  };
  const inputStyle = {
    flex: 1,
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  };
  const submitButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: playerColor && connected && game.turn() === playerColor ? 'pointer' : 'not-allowed',
    opacity: playerColor && connected && game.turn() === playerColor ? 1 : 0.7,
  };
  const loadingContainerStyle = {
    display: isLoading ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
    backgroundColor: 'rgba(255,255,255,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  };
  const boardOverlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    display: (!connected || !playerColor || (playerColor && game.turn() !== playerColor)) ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
    pointerEvents: 'none', // Allow clicks through to the board.
  };
  const overlayTextStyle = {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '5px',
    fontWeight: 'bold',
    pointerEvents: 'none',
  };
  const playerInfoStyle = {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '5px',
    textAlign: 'center',
  };

  // Render the player name input modal.
  const renderNameModal = () => {
    if (!showNameModal) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center',
          width: '300px'
        }}>
          <h3>Enter Your Name</h3>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            style={{ width: '100%', padding: '8px', marginTop: '10px', marginBottom: '10px' }}
          />
          <button
            onClick={() => {
              if (nameInput.trim() === "") {
                console.log("Empty name input, showing alert");
                alert("Please enter a valid name.");
              } else {
                console.log("Setting player name:", nameInput.trim());
                setPlayerName(nameInput.trim());
                setShowNameModal(false);
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Join Game
          </button>
        </div>
      </div>
    );
  };

  // Get overlay text based on current state.
  const getOverlayText = () => {
    if (!connected) return "Connect to play";
    if (!playerColor) return "Waiting for game to assign your color...";
    if (playerColor && game.turn() !== playerColor) return `${game.turn() === 'w' ? 'White' : 'Black'}'s turn`;
    return "";
  };

  console.log("Rendering ChessGame component with state:", {
    connected,
    playerColor,
    currentTurn: game.turn(),
    gameId,
    opponent,
    moveLogLength: moveLog.length
  });

  return (
    <div style={containerStyle}>
      {renderNameModal()}
      <div style={boardContainerStyle}>
        <div style={statusStyle}>{gameStatus}</div>
        <div style={systemMessageStyle}>{systemMessage}</div>
        <div style={errorMessageStyle}>{error}</div>
        <div style={playerInfoStyle}>
          {playerName && <div>Your name: <strong>{playerName}</strong></div>}
          {playerColor && <div>Playing as: <strong>{playerColor === 'w' ? 'White' : 'Black'}</strong></div>}
          {opponent && <div>Opponent: <strong>{opponent}</strong></div>}
          <div style={{ marginTop: '5px', color: connected ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
            {connected ? 'ONLINE' : 'OFFLINE'} MODE
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Chessboard
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            customBoardStyle={{ borderRadius: "5px", boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}
            customDarkSquareStyle={{ backgroundColor: darkSquareColor }}
            customLightSquareStyle={{ backgroundColor: lightSquareColor }}
            boardOrientation={playerColor === 'b' ? 'black' : 'white'}
            isDraggablePiece={isDraggablePiece}
          />
          <div style={boardOverlayStyle}>
            <div style={overlayTextStyle}>{getOverlayText()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: '15px' }}>
          <button
            onClick={resetGame}
            style={buttonStyle}
            onMouseOver={e => e.target.style.backgroundColor = "#1976d2"}
            onMouseOut={e => e.target.style.backgroundColor = "#2196f3"}
          >
            New Game
          </button>
          <button
            onClick={leaveGame}
            style={leaveButtonStyle}
            onMouseOver={e => e.target.style.backgroundColor = "#d32f2f"}
            onMouseOut={e => e.target.style.backgroundColor = "#f44336"}
          >
            Leave Game
          </button>
        </div>
      </div>
      <div style={moveLogStyle}>
        <h2 style={{ marginBottom: '15px', fontSize: '18px' }}>Move History</h2>
        <div ref={moveListRef} style={moveListStyle}>
          {moveLog.length > 0 ? (
            moveLog.map((move, index) => (
              <div key={index} style={moveItemStyle(index)}>
                {move}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
              No moves yet
            </div>
          )}
        </div>
        {/* Manual move input form */}
        <form onSubmit={handleSubmit} style={formStyle}>
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder="Enter move (e.g., e2e4)"
            style={inputStyle}
            disabled={!connected || !playerColor || (playerColor && game.turn() !== playerColor)}
          />
          <button 
            type="submit" 
            style={submitButtonStyle}
            onMouseOver={e => {
              if (playerColor && connected && game.turn() === playerColor) {
                e.target.style.backgroundColor = "#388e3c";
              }
            }}
            onMouseOut={e => {
              if (playerColor && connected && game.turn() === playerColor) {
                e.target.style.backgroundColor = "#4caf50";
              }
            }}
            disabled={!connected || !playerColor || (playerColor && game.turn() !== playerColor)}
          >
            Submit
          </button>
        </form>
      </div>
      {/* Loading overlay */}
      <div style={loadingContainerStyle}>
        <div>Loading game...</div>
      </div>
    </div>
  );
};

export default ChessGame;