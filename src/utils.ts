/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chess } from 'chess.js';

// Piece weights for static evaluation
export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Heuristic Positional Tables (from Black's perspective, flip row for White)
// Pawn Table: encourage keeping center, advancing, and protecting the king
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

// Knight Table: encourage controlling the center, discourage edges
const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

// Bishop Table: discourage corners, encourage diagonal placement
const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

// Rook Table: encourage columns, control 7th rank
const ROOK_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

// Queen Table: encourage active but safe positions
const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

// King Table (Middle game safety)
const KING_MIDDLE_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

// Get cell score from positional table
function getPositionalValue(piece: string, color: string, r: number, c: number): number {
  let table: number[][];
  switch (piece) {
    case 'p': table = PAWN_TABLE; break;
    case 'n': table = KNIGHT_TABLE; break;
    case 'b': table = BISHOP_TABLE; break;
    case 'r': table = ROOK_TABLE; break;
    case 'q': table = QUEEN_TABLE; break;
    case 'k': table = KING_MIDDLE_TABLE; break;
    default: return 0;
  }

  // White is evaluated from bottom up, so flip the row index for black tables
  const row = color === 'w' ? 7 - r : r;
  return table[row]?.[c] || 0;
}

// Evaluate board position state static score
// Positive means white is winning, Negative means black is winning
export function evaluateBoard(game: Chess): number {
  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (square) {
        const pieceType = square.type;
        const color = square.color;
        
        let value = PIECE_VALUES[pieceType];
        value += getPositionalValue(pieceType, color, r, c);
        
        if (color === 'w') {
          score += value;
        } else {
          score -= value;
        }
      }
    }
  }
  return score;
}

// Minimax algorithm with Alpha-Beta pruning
// Returns [bestScore, bestMove]
function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean
): [number, any | null] {
  if (depth === 0 || game.isGameOver()) {
    return [evaluateBoard(game), null];
  }

  const moves = game.moves({ verbose: true });
  let bestMove: any | null = null;

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const [evaluation] = minimax(game, depth - 1, alpha, beta, false);
      game.undo();

      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // beta prune
      }
    }
    return [maxEval, bestMove];
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const [evaluation] = minimax(game, depth - 1, alpha, beta, true);
      game.undo();

      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // alpha prune
      }
    }
    return [minEval, bestMove];
  }
}

/**
 * Calculates the best computer/bot chess move for the requested color
 */
export function calculateBestMove(
  fen: string,
  difficulty: 'easy' | 'medium' | 'hard' | 'gemini',
  botColor: 'w' | 'b'
): { from: string; to: string; san: string } | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });

  if (moves.length === 0) return null;

  // Easy mode: full random legal move
  if (difficulty === 'easy') {
    const randomIndex = Math.floor(Math.random() * moves.length);
    const chosen = moves[randomIndex];
    return { from: chosen.from, to: chosen.to, san: chosen.san };
  }

  // Medium mode: search depth 1
  if (difficulty === 'medium') {
    const isMaximizing = botColor === 'w';
    const depth = 1;
    const [_, chosenMove] = minimax(game, depth, -Infinity, Infinity, isMaximizing);
    
    if (chosenMove) {
      return { from: chosenMove.from, to: chosenMove.to, san: chosenMove.san };
    }
    // Fallback to random if something goes wrong
    const rIdx = Math.floor(Math.random() * moves.length);
    const chosen = moves[rIdx];
    return { from: chosen.from, to: chosen.to, san: chosen.san };
  }

  // Hard or Gemini fallback mode: search depth 3 (or depth 2 if move numbers are massive)
  const isMaximizing = botColor === 'w';
  const depth = moves.length > 35 ? 2 : 3;
  const [_, chosenMove] = minimax(game, depth, -Infinity, Infinity, isMaximizing);

  if (chosenMove) {
    return { from: chosenMove.from, to: chosenMove.to, san: chosenMove.san };
  }

  // Absolute fallback
  const firstMove = moves[0];
  return { from: firstMove.from, to: firstMove.to, san: firstMove.san };
}

/**
 * Clean up strings or generate standard short IDs
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Formats time in seconds to mm:ss format
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a complete visual depiction of the chess board for prompt submission
 */
export function generateAsciiBoardDescription(fen: string): string {
  const game = new Chess(fen);
  const board = game.board();
  let description = `Giliran: ${game.turn() === 'w' ? 'Putih' : 'Hitam'}\n`;
  description += `Papan Catur:\n`;
  description += `  a   b   c   d   e   f   g   h\n`;
  
  for (let r = 0; r < 8; r++) {
    let rowStr = `${8 - r} `;
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (square) {
        const piece = square.type.toUpperCase();
        const col = square.color === 'w' ? 'W' : 'B';
        rowStr += `[${col}${piece}]`;
      } else {
        rowStr += `[  ]`;
      }
    }
    description += rowStr + ` ${8 - r}\n`;
  }
  description += `  a   b   c   d   e   f   g   h\n`;
  return description;
}
