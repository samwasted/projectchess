package com.chess.chess_backend.model.dto;

public interface Message {
    String getType();
    String getGameId();
    String getContent();
}
