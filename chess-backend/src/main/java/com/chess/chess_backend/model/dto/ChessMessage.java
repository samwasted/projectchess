package com.chess.chess_backend.model.dto;

import com.chess.chess_backend.enumeration.GameState;
import com.chess.chess_backend.model.ChessGame;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Chess messages.
 *
 * Contains details about the current state of a Chess game,
 * including players, board state, move (in algebraic notation), etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChessMessage implements Message {
    private String type;
    private String gameId;
    private String player1;
    private String player2;
    private String winner;
    private String turn;
    private String content;
    private String[][] board;
    // Change move to String for algebraic notation (e.g., "e2e4")
    private String move;
    private GameState gameState;
    private String sender;

    /**
     * Constructs a ChessMessage from a ChessGame object.
     *
     * @param game the ChessGame object from which to construct the message
     */
    public ChessMessage(ChessGame game) {
        this.gameId = game.getGameId();
        this.player1 = game.getPlayer1();
        this.player2 = game.getPlayer2();
        this.winner = game.getWinner();
        this.turn = game.getTurn();
        this.board = game.getBoard();
        this.gameState = game.getGameState();
    }
}

