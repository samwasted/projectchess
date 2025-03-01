package com.chess.chess_backend.manager;

import com.chess.chess_backend.enumeration.GameState;
import com.chess.chess_backend.model.ChessGame;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Manager class for Chess games.
 * Handles adding and removing players from games, and storing and retrieving the current games.
 */
@Service
public class ChessManager {
    private static final Logger logger = Logger.getLogger(ChessManager.class.getName());

    // Map of active Chess games, with the game ID as the key.
    private final Map<String, ChessGame> games;
    // Map of players waiting to join a Chess game, with the player's name as the key and game ID as the value.
    protected final Map<String, String> waitingPlayers;

    /**
     * Constructs a new ChessGameManager.
     */
    public ChessManager() {
        games = new ConcurrentHashMap<>();
        waitingPlayers = new ConcurrentHashMap<>();
    }

    /**
     * Attempts to add a player to an existing Chess game or creates a new one if none are waiting.
     *
     * @param player the name of the player
     * @return the Chess game the player was added to
     */
    public synchronized ChessGame joinGame(String player) {
        if (player == null || player.trim().isEmpty()) {
            throw new IllegalArgumentException("Player name cannot be null or empty");
        }

        // If the player is already in a game, return that game.
        ChessGame existingGame = getGameByPlayer(player);
        if (existingGame != null) {
            logger.info("Player '" + player + "' is already in a game: " + existingGame.getGameId());
            return existingGame;
        }

        // Log the current waiting players pool.
        logger.info("Current waiting players: " + waitingPlayers);

        // Remove any stale waiting entry for this player.
        waitingPlayers.remove(player);

        // Look for a waiting player (i.e., a player in waitingPlayers who is not the current player).
        for (Map.Entry<String, String> entry : waitingPlayers.entrySet()) {
            String waitingPlayer = entry.getKey();
            if (!waitingPlayer.equals(player)) {
                String gameId = entry.getValue();
                ChessGame waitingGame = games.get(gameId);
                if (waitingGame != null && waitingGame.getPlayer2() == null) {
                    // Pair the waiting player with the current player.
                    waitingGame.setPlayer2(player);
                    // Assume waiting player (player1) is White; game starts with player1's turn.
                    waitingGame.setGameState(GameState.PLAYER1_TURN);
                    waitingGame.setTurn(waitingGame.getPlayer1());
                    // Remove the waiting entry since pairing is done.
                    waitingPlayers.remove(waitingPlayer);
                    // Also ensure this player isn't in waiting players.
                    waitingPlayers.remove(player);
                    logger.info("Paired players: " + waitingPlayer + " (Player1) and " + player + " (Player2)");
                    return waitingGame;
                }
            }
        }

        // No waiting player available; create a new game.
        ChessGame newGame = new ChessGame(player, null);
        games.put(newGame.getGameId(), newGame);
        waitingPlayers.put(player, newGame.getGameId());
        logger.info("New game created with waiting player: " + player + " (GameID: " + newGame.getGameId() + ")");
        return newGame;
    }


    /**
     * Removes a player from their Chess game. If the player was the only one in the game,
     * the game is removed. If player1 leaves and a second player exists, that player is promoted
     * to player1, the game state resets to WAITING_FOR_PLAYER, and the move history is cleared.
     *
     * @param player the name of the player leaving the game
     * @return the updated Chess game, or null if the game was removed
     */
    public synchronized ChessGame leaveGame(String player) {
        if (player == null || player.trim().isEmpty()) {
            logger.warning("Attempted to remove null or empty player name");
            return null;
        }

        ChessGame game = getGameByPlayer(player);
        if (game != null) {
            // Remove the leaving player's waiting entry (if present).
            waitingPlayers.remove(player);

            // Determine which player is leaving and declare the other as winner.
            if (player.equals(game.getPlayer1())) {
                if (game.getPlayer2() != null) {
                    // If player1 leaves and player2 exists, declare player2 as the winner.
                    game.setGameState(GameState.PLAYER2_WON);
                    game.setWinner(game.getPlayer2());
                } else {
                    // No opponent exists; remove the game.
                    removeGame(game.getGameId());
                    logger.info("Player '" + player + "' left. Game " + game.getGameId() + " removed (no opponents).");
                    return null;
                }
            } else if (player.equals(game.getPlayer2())) {
                if (game.getPlayer1() != null) {
                    // If player2 leaves and player1 exists, declare player1 as the winner.
                    game.setGameState(GameState.PLAYER1_WON);
                    game.setWinner(game.getPlayer1());
                } else {
                    // No opponent exists; remove the game.
                    removeGame(game.getGameId());
                    logger.info("Player '" + player + "' left. Game " + game.getGameId() + " removed (no opponents).");
                    return null;
                }
            }

            // At this point, a winner is declared and the game is over.
            // Remove the game from active games.
            removeGame(game.getGameId());
            logger.info("Game " + game.getGameId() + " ended due to player leaving. Winner: " + game.getWinner());
            return game;
        }
        logger.info("Player '" + player + "' was not found in any game.");
        return null;
    }


    /**
     * Retrieves the Chess game with the specified game ID.
     *
     * @param gameId the game ID
     * @return the corresponding Chess game, or null if not found
     */
    public synchronized ChessGame getGame(String gameId) {
        if (gameId == null || gameId.trim().isEmpty()) {
            return null;
        }
        return games.get(gameId);
    }

    /**
     * Finds and returns the Chess game that the specified player is part of.
     *
     * @param player the player's name
     * @return the Chess game containing the player, or null if none is found
     */
    public synchronized ChessGame getGameByPlayer(String player) {
        if (player == null || player.trim().isEmpty()) {
            return null;
        }

        // First check if player is in waiting players map
        String gameId = waitingPlayers.get(player);
        if (gameId != null) {
            ChessGame game = games.get(gameId);
            if (game != null) {
                return game;
            } else {
                // Clean up orphaned waiting player entry
                waitingPlayers.remove(player);
            }
        }

        // Search through all games
        return games.values().stream()
                .filter(game -> (game.getPlayer1() != null && game.getPlayer1().equals(player)) ||
                        (game.getPlayer2() != null && game.getPlayer2().equals(player)))
                .findFirst()
                .orElse(null);
    }

    /**
     * Removes the Chess game with the given game ID.
     *
     * @param gameId the ID of the game to remove
     */
    public synchronized void removeGame(String gameId) {
        if (gameId == null || gameId.trim().isEmpty()) {
            return;
        }

        ChessGame game = games.remove(gameId);
        if (game != null) {
            if (game.getPlayer1() != null) {
                waitingPlayers.remove(game.getPlayer1());
            }
            if (game.getPlayer2() != null) {
                waitingPlayers.remove(game.getPlayer2());
            }
            logger.info("Game " + gameId + " removed from active games.");
        }
    }

    /**
     * Returns the number of players waiting for opponents.
     *
     * @return the count of waiting players
     */
    public int getWaitingPlayersCount() {
        return waitingPlayers.size();
    }

    /**
     * Cleans up stale game entries and waiting players.
     * This method should be called periodically.
     */
    public synchronized void cleanupStaleEntries() {
        // Remove games with no players
        games.entrySet().removeIf(entry -> {
            ChessGame game = entry.getValue();
            return game.getPlayer1() == null && game.getPlayer2() == null;
        });

        // Remove waiting player entries that reference non-existent games
        waitingPlayers.entrySet().removeIf(entry -> !games.containsKey(entry.getValue()));

        logger.info("Cleaned up stale entries. Games remaining: " + games.size() + ", Waiting players: " + waitingPlayers.size());
    }
}