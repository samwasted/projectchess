package com.chess.chess_backend.controller;

import com.chess.chess_backend.manager.ChessManager;
import com.chess.chess_backend.model.ChessGame;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller for handling HTTP requests and returning the current Chess game state as JSON.
 *
 * GET /chess/{gameId} returns a JSON response with:
 * - fen: The complete FEN string (e.g., "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
 * - moveHistory: An array of moves (in algebraic notation)
 * - player1: Name of the first player (if assigned)
 * - player2: Name of the second player (if assigned)
 * - gameState: Current game state (e.g., WAITING_FOR_PLAYER, PLAYER1_TURN, etc.)
 * - turn: Whose turn it is (e.g., "w" or "b")
 *
 * If the game is not found, an error message is returned.
 *
 */
@RestController
@RequestMapping("/chess")
public class ChessController {

    private final ChessManager chessManager;

    @Autowired
    public ChessController(ChessManager chessManager) {
        this.chessManager = chessManager;
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<?> getChessGame(@PathVariable String gameId) {
        ChessGame game = chessManager.getGame(gameId);

        if (game != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("fen", game.getFen());
            response.put("moveHistory", game.getMoveHistory().toArray(new String[0]));
            response.put("player1", game.getPlayer1());
            response.put("player2", game.getPlayer2());
            response.put("gameState", game.getGameState().name());
            response.put("turn", game.getTurn());
            return ResponseEntity.ok(response);
        } else {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Game not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
    }

    // Optionally, you can leave your default GET mapping if you want a fallback.
    @GetMapping
    public ResponseEntity<Map<String, Object>> getDefaultChessGame() {
        Map<String, Object> response = new HashMap<>();
        response.put("fen", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        response.put("moveHistory", new String[]{});
        response.put("player1", null);
        response.put("player2", null);
        response.put("gameState", "WAITING_FOR_PLAYER");
        response.put("turn", "w");
        return ResponseEntity.ok(response);
    }
}