/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { formatTime } from '../utils';

interface ChessClockProps {
  whiteTimeSec: number;
  blackTimeSec: number;
  activeColor: 'w' | 'b';
  gameStatus: string;
  onTimeout: (loserColor: 'w' | 'b') => void;
  // Local game manual handler (updates and tracks clocks offline)
  isOnlineMode: boolean;
  onTickLocal?: (whiteTime: number, blackTime: number) => void;
}

export const ChessClock: React.FC<ChessClockProps> = ({
  whiteTimeSec,
  blackTimeSec,
  activeColor,
  gameStatus,
  onTimeout,
  isOnlineMode,
  onTickLocal,
}) => {
  const latestTimeoutRef = useRef<((loserColor: 'w' | 'b') => void) | null>(null);
  const latestLocalTickRef = useRef<((white: number, black: number) => void) | null>(null);

  // Keep references fresh to avoid stale useEffect captures
  latestTimeoutRef.current = onTimeout;
  latestLocalTickRef.current = onTickLocal || null;

  // Handles time ticking for local and bot games
  useEffect(() => {
    if (isOnlineMode) return; // Online timer is authoritative on server/room
    if (gameStatus !== 'playing') return;

    let localWhite = whiteTimeSec;
    let localBlack = blackTimeSec;

    const interval = setInterval(() => {
      if (activeColor === 'w') {
        localWhite = Math.max(0, localWhite - 1);
        if (latestLocalTickRef.current) {
          latestLocalTickRef.current(localWhite, localBlack);
        }
        if (localWhite === 0) {
          clearInterval(interval);
          if (latestTimeoutRef.current) latestTimeoutRef.current('w');
        }
      } else {
        localBlack = Math.max(0, localBlack - 1);
        if (latestLocalTickRef.current) {
          latestLocalTickRef.current(localWhite, localBlack);
        }
        if (localBlack === 0) {
          clearInterval(interval);
          if (latestTimeoutRef.current) latestTimeoutRef.current('b');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeColor, gameStatus, isOnlineMode, whiteTimeSec, blackTimeSec]);

  const isWhiteUrgent = whiteTimeSec < 30;
  const isBlackUrgent = blackTimeSec < 30;

  return (
    <div id="chess-clocks-container" className="grid grid-cols-2 gap-4 my-2 font-mono">
      {/* White Clock */}
      <div
        className={`p-4 rounded-none border transition-all ${
          activeColor === 'w' && gameStatus === 'playing'
            ? isWhiteUrgent
              ? 'bg-red-950/20 border-red-500 shadow-xl'
              : 'bg-white text-black border-white shadow-2xl'
            : 'bg-[#151515] text-[#F0F0F0] border-[#222] opacity-60'
        }`}
      >
        <div className="flex justify-between items-end mb-2">
          <span className={`text-[9px] font-black uppercase tracking-widest ${
            activeColor === 'w' && gameStatus === 'playing' && !isWhiteUrgent ? 'text-black/60' : 'text-gray-500'
          }`}>
            PUTIH (WHITE)
          </span>
          <div className="flex items-center space-x-1.5">
            {isWhiteUrgent && gameStatus === 'playing' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-bounce" />
            ) : null}
            <span
              className={`text-2xl font-mono font-black leading-none ${
                isWhiteUrgent && gameStatus === 'playing' ? 'text-red-400' : ''
              }`}
            >
              {formatTime(whiteTimeSec)}
            </span>
          </div>
        </div>
        <div className="w-full bg-[#222]/30 h-1">
          <div 
            style={{ width: `${Math.min(100, (whiteTimeSec / (onTickLocal ? 600 : 600)) * 100)}%` }} 
            className={`h-full transition-all duration-1000 ${
              activeColor === 'w' && gameStatus === 'playing' && !isWhiteUrgent ? 'bg-black' : 'bg-white'
            }`}
          ></div>
        </div>
      </div>

      {/* Black Clock */}
      <div
        className={`p-4 rounded-none border transition-all ${
          activeColor === 'b' && gameStatus === 'playing'
            ? isBlackUrgent
              ? 'bg-red-950/20 border-red-500 shadow-xl'
              : 'bg-white text-black border-white shadow-2xl'
            : 'bg-[#151515] text-[#F0F0F0] border-[#222] opacity-60'
        }`}
      >
        <div className="flex justify-between items-end mb-2">
          <span className={`text-[9px] font-black uppercase tracking-widest ${
            activeColor === 'b' && gameStatus === 'playing' && !isBlackUrgent ? 'text-black/60' : 'text-gray-500'
          }`}>
            HITAM (BLACK)
          </span>
          <div className="flex items-center space-x-1.5">
            {isBlackUrgent && gameStatus === 'playing' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-bounce" />
            ) : null}
            <span
              className={`text-2xl font-mono font-black leading-none ${
                isBlackUrgent && gameStatus === 'playing' ? 'text-red-400' : ''
              }`}
            >
              {formatTime(blackTimeSec)}
            </span>
          </div>
        </div>
        <div className="w-full bg-[#222]/30 h-1">
          <div 
            style={{ width: `${Math.min(100, (blackTimeSec / 600) * 100)}%` }} 
            className={`h-full transition-all duration-1000 ${
              activeColor === 'b' && gameStatus === 'playing' && !isBlackUrgent ? 'bg-black' : 'bg-white'
            }`}
          ></div>
        </div>
      </div>
    </div>
  );
};
