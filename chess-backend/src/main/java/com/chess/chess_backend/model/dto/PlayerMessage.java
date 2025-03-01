package com.chess.chess_backend.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerMessage implements Message {
    private String type;
    private String gameId;
    private String player;
    private String content;
}