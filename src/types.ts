/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameMode = 'local' | 'ai' | 'online';

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface Player {
  id: string;
  name: string;
  isBot?: boolean;
  color?: PieceColor;
  isOnline: boolean;
}

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'gemini';

export interface ChessTimer {
  whiteTimeSec: number;
  blackTimeSec: number;
  initialTimeSec: number;
  lastTickTimestamp: number | null;
  isRunning: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ChessMoveRecord {
  san: string;
  from: string;
  to: string;
  piece: PieceType;
  color: PieceColor;
  timestamp: number;
}

export interface ChessRoom {
  id: string;
  fen: string;
  turn: PieceColor;
  status: 'lobby' | 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout';
  winner: PieceColor | null;
  whitePlayer: Player | null;
  blackPlayer: Player | null;
  moves: ChessMoveRecord[];
  chat: ChatMessage[];
  createdAt: number;
  lastMovedAt: number;
  timer: ChessTimer;
}

export interface AICoachResponse {
  analysis: string; // Dynamic chess evaluation in Indonesian.
  tacticalTip: string; // Explaining the visual threats/opportunities.
  suggestedMove: {
    from: string;
    to: string;
    san: string;
    reason: string;
  } | null;
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}
