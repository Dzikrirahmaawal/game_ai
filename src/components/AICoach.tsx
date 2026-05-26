/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, HelpCircle, AlertOctagon, Lightbulb, CornerDownRight, Sparkles } from 'lucide-react';
import { AICoachResponse } from '../types';

interface AICoachProps {
  fen: string;
  moveHistory: any[];
  turn: 'w' | 'b';
  mode: string;
  onHighlightMove: (from: string, to: string) => void;
}

export const AICoach: React.FC<AICoachProps> = ({ fen, moveHistory, turn, mode, onHighlightMove }) => {
  const [coachResponse, setCoachResponse] = useState<AICoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fetchCoachAdvice = async () => {
    setLoading(true);
    setErrorText(null);

    try {
      const response = await fetch('/api/gemini/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          moveHistory,
          turn,
          mode,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setCoachResponse(data);
      } else {
        setErrorText(data.error || 'Coach AI kesulitan bersuara saat ini.');
      }
    } catch (err) {
      console.error(err);
      setErrorText('Koneksi sistem coach AI gagal. Silakan coba sesaat lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-coach-root" className="bg-[#0F0F0F] border border-[#222] rounded-none p-5 shadow-lg flex flex-col justify-between font-sans min-h-[220px]">
      
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#222] mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white flex items-center justify-center text-black font-black">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-widest">Coach AI Catur</h4>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Bantuan Taktis Real-Time</p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-white bg-[#222] px-2.5 py-1 border border-[#333] uppercase tracking-widest font-black">
            Gemini AI
          </span>
        </div>

        {/* Dynamic State Advice */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading-coach"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6 flex flex-col items-center justify-center space-y-3"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-none border-2 border-white/20 border-t-white animate-spin"></div>
                <Sparkles className="w-4 h-4 text-white absolute top-2 left-2 animate-pulse" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-500 animate-pulse text-center">
                Membaca dinamika papan catur taktis...
              </p>
            </motion.div>
          ) : errorText ? (
            <motion.div
              key="error-coach"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4 text-center text-xs text-red-400 flex flex-col items-center space-y-2"
            >
              <AlertOctagon className="w-8 h-8 text-red-500/70" />
              <span className="font-mono uppercase tracking-widest text-[10px]">{errorText}</span>
              <button
                onClick={fetchCoachAdvice}
                className="mt-2 text-[10px] font-mono uppercase tracking-widest font-black underline text-white hover:opacity-80"
              >
                Coba Hubungi Lagi
              </button>
            </motion.div>
          ) : coachResponse ? (
            <motion.div
              key="content-coach"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Analysis Text */}
              <div className="bg-[#0A0A0A] p-3.5 border border-[#222] rounded-none">
                <p className="text-xs text-gray-300 leading-relaxed font-sans font-medium">
                  "{coachResponse.analysis}"
                </p>
              </div>

              {/* Tactical Tip */}
              <div className="flex items-start space-x-2 text-xs">
                <Lightbulb className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-black text-gray-500 block text-[9px] uppercase font-mono tracking-widest">Tips Taktis</span>
                  <span className="text-gray-300 font-sans leading-relaxed">{coachResponse.tacticalTip}</span>
                </div>
              </div>

              {/* Suggested Move */}
              {coachResponse.suggestedMove && (
                <div className="bg-[#0A0A0A] p-3 border border-[#222] rounded-none flex flex-col justify-between items-start space-y-2 md:flex-row md:items-center md:space-y-0 mt-1">
                  <div className="space-y-0.5 text-xs">
                    <span className="font-black text-white block text-[9px] uppercase font-mono tracking-widest">Rekomendasi Langkah</span>
                    <div className="flex items-center text-white font-black text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 mr-1 text-white" />
                      Langkah {coachResponse.suggestedMove.san} ({coachResponse.suggestedMove.from} → {coachResponse.suggestedMove.to})
                    </div>
                    <span className="text-[11px] text-gray-400 block leading-tight mt-1">
                      {coachResponse.suggestedMove.reason}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (coachResponse.suggestedMove) {
                        onHighlightMove(coachResponse.suggestedMove.from, coachResponse.suggestedMove.to);
                      }
                    }}
                    className="flex-shrink-0 text-[10px] font-mono font-black bg-white text-black px-3 py-1.5 rounded-none uppercase tracking-widest hover:bg-gray-250 transition-all text-center cursor-pointer"
                  >
                    Sorot Langkah
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="intro-coach"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4 text-center"
            >
              <div className="flex justify-center mb-2">
                <HelpCircle className="w-8 h-8 text-gray-600/80" />
              </div>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Bingung melangkah atau butuh evaluasi taktis? Klik tombol "Tanya Coach" di bawah untuk menganalisis keadaan papan!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Button to call Coach */}
      <div className="mt-4 pt-3 border-t border-[#222] flex justify-end">
        <button
          onClick={fetchCoachAdvice}
          disabled={loading}
          className="w-full sm:w-auto py-2.5 px-6 bg-white hover:bg-gray-200 text-black rounded-none border-none font-black flex items-center justify-center text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-black" />
          Tanya Coach AI
        </button>
      </div>

    </div>
  );
};
