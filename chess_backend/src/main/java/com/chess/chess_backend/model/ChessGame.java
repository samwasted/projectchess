package com.chess.chess_backend.model;

import com.chess.chess_backend.enumeration.GameState;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Class representing a Chess game.
 *
 * This simplified model stores the move history in algebraic notation.
 * It computes the current board by starting with the standard setup and applying all moves.
 * Detailed chess rules (like castling, promotion, en passant, or full move validation) are not implemented.
 *
 * Author: Joabson Arley do Nascimento
 */
@Getter
@Setter
public class ChessGame {
    private String gameId;
    private List<String> moveHistory;
    private String player1; // White
    private String player2; // Black
    private String winner;
    private String turn;
    private GameState gameState;

    /**
     * Constructs a new ChessGame.
     * If player2 is null, the game is considered waiting for a second player.
     *
     * @param player1 the name of the first player (White)
     * @param player2 the name of the second player (Black), or null if not yet assigned
     */
    public ChessGame(String player1, String player2) {
        this.gameId = UUID.randomUUID().toString();
        this.player1 = player1;
        this.player2 = player2;
        this.moveHistory = new ArrayList<>();
        // White (player1) always starts.
        this.turn = player1;
        // Set initial game state: if player2 is not set, wait for a second player.
        this.gameState = (player2 == null) ? GameState.WAITING_FOR_PLAYER : GameState.PLAYER1_TURN;
    }

    /**
     * Returns the current state of the board as an 8x8 array.
     * The board starts with the standard initial positions and all moves in moveHistory are applied sequentially.
     *
     * @return an 8x8 array representing the chess board.
     */
    public String[][] getBoard() {
        // Create the initial board.
        String[][] board = new String[8][8];

        // Black pieces (lowercase) at the top.
        board[0] = new String[]{"r", "n", "b", "q", "k", "b", "n", "r"};
        board[1] = new String[]{"p", "p", "p", "p", "p", "p", "p", "p"};

        // Middle squares empty.
        for (int i = 2; i <= 5; i++) {
            Arrays.fill(board[i], " ");
        }

        // White pieces (uppercase) at the bottom.
        board[6] = new String[]{"P", "P", "P", "P", "P", "P", "P", "P"};
        board[7] = new String[]{"R", "N", "B", "Q", "K", "B", "N", "R"};

        // Apply all moves in the move history.
        for (String move : moveHistory) {
            board = applyMove(board, move);
        }
        return board;
    }

    /**
     * Converts the current board state to a FEN string.
     * This implementation computes the piece placement from the board and appends default values
     * for active color, castling, en passant target, halfmove clock, and fullmove number.
     *
     * @return a complete FEN string.
     */
    public String getFen() {
        String[][] board = getBoard();
        StringBuilder fenBuilder = new StringBuilder();
        for (int row = 0; row < 8; row++) {
            int emptyCount = 0;
            for (int col = 0; col < 8; col++) {
                String piece = board[row][col];
                if (piece.equals(" ")) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fenBuilder.append(emptyCount);
                        emptyCount = 0;
                    }
                    fenBuilder.append(piece);
                }
            }
            if (emptyCount > 0) {
                fenBuilder.append(emptyCount);
            }
            if (row < 7) {
                fenBuilder.append("/");
            }
        }
        // Append default suffix values.
        // Note: This does not update castling rights, en passant targets, etc.
        fenBuilder.append(" w KQkq - 0 1");
        return fenBuilder.toString();
    }

    /**
     * Applies a move to the board.
     * Assumes the move is in the format "e2e4" (from-square to-square).
     *
     * @param board the current board.
     * @param move  the move to apply.
     * @return the updated board.
     */
    private String[][] applyMove(String[][] board, String move) {
        if (move == null || move.length() != 4) {
            return board;
        }
        try {
            // Convert file letter to column index (a=0, ..., h=7)
            int fromCol = move.charAt(0) - 'a';
            int toCol = move.charAt(2) - 'a';

            // Convert rank character to row index: '1' (bottom row, index 7) to '8' (top row, index 0)
            int fromRow = 8 - Character.getNumericValue(move.charAt(1));
            int toRow = 8 - Character.getNumericValue(move.charAt(3));

            // Validate indices
            if (fromCol < 0 || fromCol > 7 || fromRow < 0 || fromRow > 7 ||
                    toCol < 0 || toCol > 7 || toRow < 0 || toRow > 7) {
                return board;
            }

            // Perform the move.
            String piece = board[fromRow][fromCol];
            board[fromRow][fromCol] = " ";
            board[toRow][toCol] = piece;
        } catch (Exception e) {
            System.err.println("Error applying move: " + e.getMessage());
        }
        return board;
    }

    /**
     * Records a move in algebraic notation if it's the correct player's turn.
     * Alternates the turn after recording the move.
     *
     * @param player the player making the move.
     * @param move   the move in algebraic notation (e.g., "e2e4").
     * @return true if the move was successful, false otherwise.
     */
    public boolean makeMove(String player, String move) {
        if (!Objects.equals(player, turn)) {
            return false;
        }
        if (move == null || move.length() != 4) {
            return false;
        }
        moveHistory.add(move);
        if (Objects.equals(player, player1)) {
            turn = player2;
            gameState = GameState.PLAYER2_TURN;
        } else {
            turn = player1;
            gameState = GameState.PLAYER1_TURN;
        }
        return true;
    }

    /**
     * Returns true if the game is over (i.e. if the game state is PLAYER1_WON, PLAYER2_WON, or TIE).
     *
     * @return true if the game is over; false otherwise.
     */
    public boolean isGameOver() {
        return (gameState == GameState.PLAYER1_WON ||
                gameState == GameState.PLAYER2_WON ||
                gameState == GameState.TIE);
    }

    /**
     * Returns the player's name based on the given color.
     * "white" returns the first player; "black" returns the second player.
     *
     * @param color "white" or "black".
     * @return the corresponding player's name.
     * @throws IllegalArgumentException if the color is invalid.
     */
    public String getPlayer(String color) {
        if (color == null) {
            throw new IllegalArgumentException("Color cannot be null");
        }
        if (color.equalsIgnoreCase("white")) {
            return player1;
        } else if (color.equalsIgnoreCase("black")) {
            return player2;
        } else {
            throw new IllegalArgumentException("Invalid color: " + color);
        }
    }

    /**
     * Sets the game state to won by the specified player.
     *
     * @param player the player who won.
     * @return true if successful, false if the player is not part of this game.
     */
    public boolean setWinner(String player) {
        if (Objects.equals(player, player1)) {
            gameState = GameState.PLAYER1_WON;
            winner = player;
            return true;
        } else if (Objects.equals(player, player2)) {
            gameState = GameState.PLAYER2_WON;
            winner = player;
            return true;
        }
        return false;
    }

    /**
     * Sets the game state to a tie.
     */
    public void setTie() {
        gameState = GameState.TIE;
        winner = null;
    }
}
