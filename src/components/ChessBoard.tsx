/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { motion } from 'motion/react';
import { ChessSvg } from './ChessSvg';
import { evaluateBoard } from '../utils';

interface ChessBoardProps {
  fen: string;
  playerColor: 'w' | 'b' | 'both'; // 'both' for local pass-and-play
  activeColor: 'w' | 'b';
  interactive: boolean;
  highlightedMove: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  gameStatus: string;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  playerColor,
  activeColor,
  interactive,
  highlightedMove,
  onMove,
  gameStatus,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [boardFlip, setBoardFlip] = useState(false);

  const chess = new Chess(fen);
  const board = chess.board();

  // Highlight King if in Check
  const inCheck = chess.inCheck() && gameStatus === 'playing';
  let checkedKingSquare: string | null = null;
  if (inCheck) {
    // Find king square of active turn
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq && sq.type === 'k' && sq.color === activeColor) {
          const file = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][c];
          const rank = 8 - r;
          checkedKingSquare = `${file}${rank}`;
        }
      }
    }
  }

  // Auto-align flip state based on requested player color on start
  useEffect(() => {
    setBoardFlip(playerColor === 'b');
  }, [playerColor]);

  // Clean selection if FEN or turn changes
  useEffect(() => {
    setSelectedSquare(null);
    setPossibleMoves([]);
  }, [fen, activeColor]);

  const handleSquareClick = (squareStr: string) => {
    if (!interactive || gameStatus !== 'playing') return;

    const parsedSquare = squareStr as Square;
    const piece = chess.get(parsedSquare);

    // 1. If a valid destination is clicked
    if (possibleMoves.includes(squareStr) && selectedSquare) {
      // Check for pawn promotion (moving pawn to 8th rank for white, 1st for black)
      const moveFromPiece = chess.get(selectedSquare as Square);
      const isPawn = moveFromPiece && moveFromPiece.type === 'p';
      const toRank = squareStr.charAt(1);
      const isPromotion = isPawn && (toRank === '8' || toRank === '1');

      if (isPromotion) {
        onMove(selectedSquare, squareStr, 'q'); // promotes to Queen automatically for ease
      } else {
        onMove(selectedSquare, squareStr);
      }
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // 2. Select your piece
    if (piece && piece.color === activeColor) {
      // Ensure player owns this color in single team mode
      if (playerColor !== 'both' && playerColor !== activeColor) {
        return; // Click blocked, not player's piece team
      }

      setSelectedSquare(squareStr);
      const legalMovesVerbose = chess.moves({ square: parsedSquare, verbose: true }) as any[];
      const destinations = legalMovesVerbose.map((m) => m.to);
      setPossibleMoves(destinations);
    } else {
      // Clicked empty/opponent square without valid move
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  // Construct render coordinates
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Invert arrays if board is flipped
  const activeRows = boardFlip ? [...rows].reverse() : rows;
  const activeCols = boardFlip ? [...cols].reverse() : cols;

  const evaluationScore = evaluateBoard(chess);

  return (
    <div id="chessboard-widget-container" className="flex flex-col items-center w-full">
      
      {/* Board Alignment Switcher */}
      <div className="w-full max-w-lg mb-3 flex items-center justify-between text-[10px] font-mono text-gray-400">
        <button
          onClick={() => setBoardFlip(!boardFlip)}
          className="px-3 py-1.5 bg-[#111] hover:bg-[#222] border border-[#333] rounded-none uppercase font-black tracking-widest hover:text-white transition-all cursor-pointer"
        >
          Putar Papan Catur 🔄
        </button>
        <div className="flex items-center space-x-1 uppercase tracking-widest font-black text-gray-500">
          <span>Keseimbangan Papan:</span>
          <span className={`font-mono font-black ${evaluationScore > 0 ? 'text-white' : evaluationScore < 0 ? 'text-white/60' : 'text-gray-400'}`}>
            {evaluationScore > 0 ? `+${(evaluationScore/100).toFixed(1)}` : (evaluationScore/100).toFixed(1)}
          </span>
        </div>
      </div>

      {/* Actual Chess Layout */}
      <div className="w-full max-w-[480px] aspect-square bg-[#0A0A0A] border-4 border-[#1A1A1A] rounded-none shadow-2xl relative overflow-hidden">
        
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {activeRows.map((r) => {
            return activeCols.map((c) => {
              const file = files[c];
              const rank = ranks[r];
              const squareStr = `${file}${rank}`;
              
              const isDark = (r + c) % 2 === 1;
              const squareData = board[r][c];
              
              const isSelected = selectedSquare === squareStr;
              const isPossible = possibleMoves.includes(squareStr);
              const isChecked = checkedKingSquare === squareStr;
              
              // Highlighting move recommended by AI coach
              const isCoachHighlighted = highlightedMove && (highlightedMove.from === squareStr || highlightedMove.to === squareStr);

              // Square styling to match the custom chess board mockups in Design HTML
              const lightBg = 'bg-[#E5E5E5]'; // Stark light piece area
              const darkBg = 'bg-[#2A2A2A]'; // Stark dark piece area
              const selectBg = 'shadow-inner ring-4 ring-white/70 bg-white/30';
              const coachBg = 'ring-4 ring-white/90 shadow-2xl bg-white/20';

              return (
                <div
                  key={squareStr}
                  id={`square-${squareStr}`}
                  onClick={() => handleSquareClick(squareStr)}
                  className={`relative flex items-center justify-center cursor-pointer select-none transition-shadow ${
                    isSelected ? selectBg : isCoachHighlighted ? coachBg : isDark ? darkBg : lightBg
                  } ${isChecked ? 'shadow-inner ring-4 ring-red-600 bg-red-600/35' : ''}`}
                >
                  {/* Pieces (animated with subtle Framer Motion scale-ins) */}
                  {squareData && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                      className="w-[82%] h-[82%] z-10 flex items-center justify-center"
                    >
                      <ChessSvg type={squareData.type} color={squareData.color} />
                    </motion.div>
                  )}

                  {/* Possible Move Indicators */}
                  {isPossible && (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      {squareData ? (
                        // Target capture indicator square
                        <div className="w-[85%] h-[85%] rounded-none border-4 border-white/80 animate-pulse"></div>
                      ) : (
                        // Standard square dot
                        <div className="w-3.5 h-3.5 rounded-none bg-white/80 shadow shadow-black"></div>
                      )}
                    </div>
                  )}

                  {/* Rank & File Coordinates on Borders for premium visual finish */}
                  {c === (boardFlip ? 7 : 0) && (
                    <span className={`absolute top-0.5 left-1 text-[9px] font-black font-mono transition-colors ${
                      isDark ? 'text-[#E5E5E5]/40' : 'text-[#2A2A2A]/40'
                    }`}>
                      {rank}
                    </span>
                  )}
                  {r === (boardFlip ? 0 : 7) && (
                    <span className={`absolute bottom-0.5 right-1 text-[9px] font-black font-mono transition-colors ${
                      isDark ? 'text-[#E5E5E5]/40' : 'text-[#2A2A2A]/40'
                    }`}>
                      {file}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
};
