import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from "chess.js";
import { Chessboard } from 'react-chessboard';

const ChessGame = () => {
    const darkSquareColor = "#B58863";
    const lightSquareColor = "#F0D9B5"; //can change manually
    const [game, setGame] = useState(new Chess());
    const [moveLog, setMoveLog] = useState([]);
    const moveListRef = useRef(null);

    const [inputValue, setInputValue] = useState("");

    const handleChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleSubmit = useCallback(() => {
        try {
            const move = game.move(inputValue);
            if (!move) return false;
            setGame(new Chess(game.fen()));
            const moveNotation = `${game.turn() === 'b' ? 'White' : 'Black'}: ${move.san}`;
            setMoveLog(prev => [...prev, moveNotation]);
            setInputValue(""); // Clear input after successful move
            return true;
        } catch (error) {
            return false;
        }
    }, [game, inputValue]);

    const getGameStatus = () => {
        if (game.isGameOver()) {
            if (game.isCheckmate()) { return 'Checkmate!'; }
            if (game.isStalemate()) { return 'Stalemate!'; }
            if (game.isDraw()) { return 'Draw!'; }
            return 'Game Over!';
        }
        if (game.inCheck()) { return 'Check!'; }
        return game.turn() === 'w' ? 'White to move' : 'Black to move';
    };

    const resetGame = () => {
        setGame(new Chess());
        setMoveLog([]);
    };

    const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
        try {
            const move = game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q'
            });
            if (move) {
                setGame(new Chess(game.fen()));
                const moveNotation = `${game.turn() === 'b' ? 'White' : 'Black'}: ${move.san}`;
                setMoveLog(prev => [...prev, moveNotation]);
                return true;
            }
        } catch (error) {
            return false;
        }
        return true;
    }, [game]);

    useEffect(() => {
        if (moveListRef.current) {
            moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
        }
    }, [moveLog]);

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        display: 'flex',
        gap: '20px',
        flexDirection: window.innerWidth < 768 ? "column" : "row"
    };
    const boardContainerStyle = {
        flex: 2,
        maxWidth: '600px',
    };
    const moveLogStyle = {
        flex: 1,
        border: '1px solid #eee',
        padding: '10px',
    };
    const moveListStyle = {
        height: '400px',
        overflowY: 'auto',
        border: '1px solid #eee',
        padding: '10px',
    };
    const moveItemStyle = {
        padding: '5px',
        borderBottom: '1px solid #eee',
        backgroundColor: 'white'
    };
    const buttonStyle = {
        padding: '8px 16px',
        backgroundColor: '#2196f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginTop: '15px',
    };
    const statusStyle = {
        fontSize: '20px',
        marginBottom: '15px',
        color: game.inCheck() ? '#d32f2f' : '#333'
    };

    return (
        <div style={containerStyle}>
            <div style={boardContainerStyle}>
                <div style={statusStyle}>
                    {getGameStatus()}
                </div>
                <Chessboard
                    position={game.fen()}
                    onPieceDrop={onPieceDrop}
                    customBoardStyle={{ borderRadius: "5px", boxShadow: "0 5px 15px rgba(0, 0, 0, 0.5)" }}
                    customDarkSquareStyle={{ backgroundColor: `${darkSquareColor}` }}
                    customLightSquareStyle={{ backgroundColor: `${lightSquareColor}` }}
                />
                <button
                    onClick={resetGame}
                    style={buttonStyle}
                    onMouseOver={e => e.target.style.backgroundColor = "#1976d2"}
                    onMouseOut={e => e.target.style.backgroundColor = "#2196f3"}
                >
                    New Game
                </button>
            </div>
            <div style={moveLogStyle}>
                <h2 style={{ marginBottom: '15px', fontSize: '18px' }}>Move History</h2>
                <div ref={moveListRef} style={moveListStyle}>
                    {moveLog.length > 0 ? (
                        moveLog.map((move, index) => (
                            <div key={index} style={moveItemStyle}>
                                {`${Math.floor(index / 2) + 1}. ${move}`}
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                            No moves yet
                        </div>
                    )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleChange}
                        placeholder="Enter move"
                    />
                    <button type="submit">Submit</button>
                </form> 
                {/* this form only exists for debugging, we will be inputing moves later in the socket (database) directly */}
            </div>
        </div>
    );
};

export default ChessGame;

//the movelogs must be stored in the database, and the game state must be updated in the database as well, so if i refresh the page, the game state will be the same