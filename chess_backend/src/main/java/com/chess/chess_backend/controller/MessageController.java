package com.chess.chess_backend.controller;

import com.chess.chess_backend.enumeration.GameState;
import com.chess.chess_backend.manager.ChessManager;
import com.chess.chess_backend.model.ChessGame;
import com.chess.chess_backend.model.dto.JoinMessage;
import com.chess.chess_backend.model.dto.PlayerMessage;
import com.chess.chess_backend.model.dto.ChessMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.logging.Logger;

/**
 * Controller class for handling WebSocket messages and managing multiplayer Chess games.
 *
 * Endpoints:
 * - /app/chess.join  : for joining a chess game.
 * - /app/chess.leave : for leaving a game.
 * - /app/chess.move  : for making a move (in algebraic notation).
 */
@Controller
public class MessageController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChessManager chessManager;


    /**
     * Handles a request from a client to join a Chess game.
     * Publishes a join message and also a system message indicating that the player has connected.
     */
    @MessageMapping("/chess.join")
    public void joinGame(@Payload JoinMessage message, SimpMessageHeaderAccessor headerAccessor) {
        if (message == null || message.getPlayer() == null || message.getPlayer().trim().isEmpty()) {
            sendErrorMessage("Invalid player data.", null);
            return;
        }

        // Check if player is already in a game to prevent double-joins
        String player = message.getPlayer();
        ChessGame game = null;

        synchronized (chessManager) {
            // Check if player is already in any game
            boolean playerAlreadyInGame = chessManager.isPlayerInAnyGame(player);

            // Only join if not already in a game
            if (!playerAlreadyInGame) {
                game = chessManager.joinGame(player);

                if (game == null) {
                    sendErrorMessage("Unable to join the chess game. The game might be full or an internal error occurred.", null);
                    return;
                }

                headerAccessor.getSessionAttributes().put("gameId", game.getGameId());
                headerAccessor.getSessionAttributes().put("player", player);
            } else {
                sendErrorMessage("You are already in a game.", null);
                return;
            }
        }

        // Send joined message with player information included
        ChessMessage joinMsg = gameToMessage(game);
        joinMsg.setType("game.joined");
        joinMsg.setContent(player + " has joined the game.");
        messagingTemplate.convertAndSend("/topic/chess." + game.getGameId(), joinMsg);

        // Only send subscription notification if actually needed
        if (game.getGameState() == GameState.WAITING_FOR_PLAYER) {
            ChessMessage subscribeMsg = new ChessMessage();
            subscribeMsg.setType("game.subscribe");
            subscribeMsg.setGameId(game.getGameId());
            subscribeMsg.setContent("Please subscribe to game-specific topic");
            messagingTemplate.convertAndSend("/topic/chess", subscribeMsg);
        }
    }

    /**
     * Handles a request from a client to leave a Chess game.
     * Sends a system message indicating the player has left, then broadcasts the updated game state.
     */
    @MessageMapping("/chess.leave")
    public void leaveGame(@Payload PlayerMessage message) {
        if (message == null || message.getPlayer() == null || message.getPlayer().trim().isEmpty()) {
            sendErrorMessage("Invalid player data.", null);
            return;
        }

        ChessGame game;
        synchronized (chessManager) {
            game = chessManager.leaveGame(message.getPlayer());
        }

        if (game != null) {
            // Broadcast combined leave message with game state
            ChessMessage gameMessage = gameToMessage(game);
            gameMessage.setType("game.left");
            gameMessage.setContent(message.getPlayer() + " has left the game.");
            messagingTemplate.convertAndSend("/topic/chess." + game.getGameId(), gameMessage);
        }
    }

    /**
     * Handles a move made by a client.
     * If valid, applies the move, broadcasts the updated game state,
     * and if the game is over, broadcasts a game over message.
     */
    @MessageMapping("/chess.move")
    public void makeMove(@Payload ChessMessage message) {
        if (message == null || message.getSender() == null || message.getGameId() == null || message.getMove() == null) {
            sendErrorMessage("Invalid move data.", null);
            return;
        }

        String player = message.getSender();
        String gameId = message.getGameId();
        String moveNotation = message.getMove(); // e.g., "e2e4"

        ChessGame game;
        synchronized (chessManager) {
            game = chessManager.getGame(gameId);

            if (game == null || game.isGameOver()) {
                sendErrorMessage("Game not found or is already over.", gameId);
                return;
            }

            if (game.getGameState().equals(GameState.WAITING_FOR_PLAYER)) {
                sendErrorMessage("Game is waiting for another player to join.", gameId);
                return;
            }

            // Verify that the player is part of the game
            if (!isPlayerInGame(player, game)) {
                sendErrorMessage("You are not a participant in this game.", gameId);
                return;
            }

            if (!game.getTurn().equals(player)) {
                sendErrorMessage("It's not your turn.", gameId);
                return;
            }

            if (!game.makeMove(player, moveNotation)) {
                sendErrorMessage("Invalid move. Please try again.", gameId);
                return;
            }
        }

        ChessMessage gameStateMessage = gameToMessage(game);
        gameStateMessage.setType("game.move");
        messagingTemplate.convertAndSend("/topic/chess." + gameId, gameStateMessage);

        if (game.isGameOver()) {
            ChessMessage gameOverMessage = gameToMessage(game);
            gameOverMessage.setType("game.gameOver");
            messagingTemplate.convertAndSend("/topic/chess." + gameId, gameOverMessage);

            // Add delay before removing the game to allow messages to be processed
            new Thread(() -> {
                try {
                    Thread.sleep(500); // Small delay to ensure message delivery
                    synchronized (chessManager) {
                        chessManager.removeGame(gameId);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }).start();
        }
    }

    /**
     * Listens for disconnect events and handles a player's disconnection.
     * Sends a system message about the disconnection, then updates the game state and broadcasts game over if applicable.
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Object gameIdObj = headerAccessor.getSessionAttributes().get("gameId");
        Object playerObj = headerAccessor.getSessionAttributes().get("player");

        if (gameIdObj == null || playerObj == null) {
            return;
        }

        String gameId = gameIdObj.toString();
        String player = playerObj.toString();

        ChessGame game;
        boolean shouldRemoveGame = false;

        synchronized (chessManager) {
            game = chessManager.getGame(gameId);
            if (game == null) {
                return;
            }

            if (game.getPlayer1() != null && game.getPlayer1().equals(player)) {
                game.setPlayer1(null);
                if (game.getPlayer2() != null) {
                    game.setGameState(GameState.PLAYER2_WON);
                    game.setWinner(game.getPlayer2());
                } else {
                    shouldRemoveGame = true;
                }
            } else if (game.getPlayer2() != null && game.getPlayer2().equals(player)) {
                game.setPlayer2(null);
                if (game.getPlayer1() != null) {
                    game.setGameState(GameState.PLAYER1_WON);
                    game.setWinner(game.getPlayer1());
                } else {
                    shouldRemoveGame = true;
                }
            }

            if (shouldRemoveGame) {
                chessManager.removeGame(gameId);
                return;
            }
        }

        // Create combined disconnection and game over message
        ChessMessage gameMessage = gameToMessage(game);
        gameMessage.setType("game.gameOver");
        gameMessage.setContent(player + " has disconnected.");
        messagingTemplate.convertAndSend("/topic/chess." + gameId, gameMessage);

        // Add delay before removing the game
        new Thread(() -> {
            try {
                Thread.sleep(500); // Small delay to ensure message delivery
                synchronized (chessManager) {
                    chessManager.removeGame(gameId);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }

    /**
     * Converts a ChessGame object to a ChessMessage DTO.
     */
    private ChessMessage gameToMessage(ChessGame game) {
        if (game == null) {
            return null;
        }

        ChessMessage message = new ChessMessage();
        message.setGameId(game.getGameId());
        message.setPlayer1(game.getPlayer1());
        message.setPlayer2(game.getPlayer2());
        message.setBoard(game.getBoard()); // Assumes getBoard() returns board state as a 2D array.
        message.setTurn(game.getTurn());
        message.setGameState(game.getGameState());
        message.setWinner(game.getWinner());
        return message;
    }

    /**
     * Sends an error message to the specified topic.
     */
    private void sendErrorMessage(String content, String gameId) {
        ChessMessage errorMessage = new ChessMessage();
        errorMessage.setType("error");
        errorMessage.setContent(content);

        if (gameId != null) {
            messagingTemplate.convertAndSend("/topic/chess." + gameId, errorMessage);
        } else {
            messagingTemplate.convertAndSend("/topic/chess", errorMessage);
        }
    }

    /**
     * Checks if the player is part of the specified game.
     */
    private boolean isPlayerInGame(String player, ChessGame game) {
        return (game.getPlayer1() != null && game.getPlayer1().equals(player)) ||
                (game.getPlayer2() != null && game.getPlayer2().equals(player));
    }
}