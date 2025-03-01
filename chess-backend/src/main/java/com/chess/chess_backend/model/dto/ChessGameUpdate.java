package com.chess.chess_backend.model.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChessGameUpdate {
    private String gameId;
    private String fen;
    private String[] moveHistory;
    private String player1;
    private String player2;
    private String gameState;
    private String turn;
    private String type;      // For example: "PLAYER_ASSIGNED" or "WAITING"
    private String content;   // Additional info, e.g., "Game paired: Alice vs Bob"

    @Override
    public String toString() {
        return "ChessGameUpdate{" +
                "gameId='" + gameId + '\'' +
                ", fen='" + fen + '\'' +
                ", moveHistory=" + java.util.Arrays.toString(moveHistory) +
                ", player1='" + player1 + '\'' +
                ", player2='" + player2 + '\'' +
                ", gameState='" + gameState + '\'' +
                ", turn='" + turn + '\'' +
                ", type='" + type + '\'' +
                ", content='" + content + '\'' +
                '}';
    }
}
