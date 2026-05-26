/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Swords, Bot, User, Globe, Trophy, Play, Check, ChevronRight, Settings } from 'lucide-react';
import { GameMode, BotDifficulty, Player } from '../types';

interface GameModesProps {
  onSelectMode: (mode: GameMode, botDiff?: BotDifficulty, playerColor?: 'w' | 'b' | 'random') => void;
  onOpenMultiplayer: () => void;
}

export const GameModes: React.FC<GameModesProps> = ({ onSelectMode, onOpenMultiplayer }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>('medium');
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | 'random'>('w');

  return (
    <div id="game-modes-root" className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Title Header with beautiful Display Typography */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white bg-[#111] px-4 py-2 border border-[#222]">
            Arena Catur Nusantara
          </span>
          <h1 className="text-5xl md:text-6xl font-black text-white mt-6 tracking-tighter uppercase leading-none">
            Chess <span className="opacity-40">.io</span> / MASTERS
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-[#666] mt-3 max-w-lg mx-auto">
            Uji kemampuan taktis melawan kecerdasan bot catur AI atau tandingi lawan secara real-time.
          </p>
        </motion.div>
      </div>

      {/* Main card grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Local Pass & Play */}
        <motion.div
          whileHover={{ y: -2 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          onClick={() => onSelectMode('local')}
          className="bg-[#0F0F0F] border border-[#222] rounded-none p-6 cursor-pointer hover:border-[#444] transition-all flex flex-col justify-between group relative overflow-hidden"
        >
          <div>
            <div className="w-10 h-10 rounded-none bg-white flex items-center justify-center mb-6 text-black font-black">
              <Swords className="w-5 h-5 text-black" />
            </div>
            <h3 className="text-lg font-black text-white tracking-widest uppercase mb-2">Pass &amp; Play</h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Bermain bergantian secara manual dengan teman Anda langsung pada satu perangkat yang sama.
            </p>
          </div>
          <div className="mt-8 flex items-center text-[10px] font-mono font-black uppercase tracking-widest text-white group-hover:translate-x-1 transition-transform">
            Main Sekarang →
          </div>
        </motion.div>

        {/* Card 2: AI Computer Bot */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-[#0F0F0F] border border-[#222] rounded-none p-6 flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="w-10 h-10 rounded-none bg-white flex items-center justify-center mb-6 text-black font-black">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <h3 className="text-lg font-black text-white tracking-widest uppercase mb-2">Tantang Bot AI</h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed mb-4">
              Uji ketangkasan taktis dengan melatih strategi melawan Bot heuristik yang cerdas atau Coach bimbingan Gemini AI.
            </p>

            {/* Config Box */}
            <div className="space-y-4 pt-3 border-t border-[#222]">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2 font-mono">Kesulitan Bot:</label>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {(['easy', 'medium', 'hard', 'gemini'] as BotDifficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDifficulty(d)}
                      className={`py-1.5 px-2 rounded-none border font-black uppercase text-left flex items-center justify-between transition-all ${
                        selectedDifficulty === d
                          ? 'bg-[#222] border-[#444] text-white'
                          : 'bg-[#0A0A0A] border-[#222] text-[#666] hover:text-white hover:border-[#333]'
                      }`}
                    >
                      <span>
                        {d === 'easy' && 'Pemula'}
                        {d === 'medium' && 'Menengah'}
                        {d === 'hard' && 'Suhu (Hard)'}
                        {d === 'gemini' && 'Gemini AI ✨'}
                      </span>
                      {selectedDifficulty === d && <Check className="w-3 h-3 text-white ml-1 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2 font-mono">Bermain Sebagai:</label>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono uppercase">
                  <button
                    onClick={() => setPlayerColor('w')}
                    className={`py-1.5 px-1 rounded-none border font-black text-center transition-all ${
                      playerColor === 'w' ? 'bg-white text-black border-white' : 'bg-[#0A0A0A] border-[#222] text-[#666]'
                    }`}
                  >
                    Putih
                  </button>
                  <button
                    onClick={() => setPlayerColor('random')}
                    className={`py-1.5 px-1 rounded-none border font-black text-center transition-all ${
                      playerColor === 'random' ? 'bg-[#333] text-white border-[#444]' : 'bg-[#0A0A0A] border-[#222] text-[#666]'
                    }`}
                  >
                    Acak
                  </button>
                  <button
                    onClick={() => setPlayerColor('b')}
                    className={`py-1.5 px-1 rounded-none border font-black text-center transition-all ${
                      playerColor === 'b' ? 'bg-[#1a1a1a] text-white border-[#333]' : 'bg-[#0A0A0A] border-[#222] text-[#666]'
                    }`}
                  >
                    Hitam
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectMode('ai', selectedDifficulty, playerColor)}
            className="mt-6 w-full h-11 bg-white hover:bg-gray-200 text-black rounded-none font-black flex items-center justify-center text-xs tracking-widest uppercase transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current mr-2" /> Mulai Tanding Bot
          </button>
        </motion.div>

        {/* Card 3: Online Matchmaking */}
        <motion.div
          whileHover={{ y: -2 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onClick={onOpenMultiplayer}
          className="bg-[#0F0F0F] border border-[#222] rounded-none p-6 cursor-pointer hover:border-[#444] transition-all flex flex-col justify-between group relative overflow-hidden"
        >
          <div>
            <div className="w-10 h-10 rounded-none bg-white flex items-center justify-center mb-6 text-black font-black">
              <Globe className="w-5 h-5 text-black" />
            </div>
            <h3 className="text-lg font-black text-white tracking-widest uppercase mb-2">Main Online</h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Buat ruang (room) atau gunakan kode unik untuk bertanding catur secara real-time dari dua perangkat berbeda.
            </p>
          </div>
          <div className="mt-8 flex items-center text-[10px] font-mono font-black uppercase tracking-widest text-white group-hover:translate-x-1 transition-transform">
            Buat / Gabung Room →
          </div>
        </motion.div>
      </div>

      {/* Rules Footer / Quick stats */}
      <div className="mt-16 flex flex-wrap justify-center gap-6 md:gap-12 opacity-40 text-[9px] font-bold uppercase tracking-[0.2em] border-t border-[#222] pt-6 font-mono">
        <div className="flex items-center">
          <Trophy className="w-3.5 h-3.5 mr-2" /> Aturan Resmi FIDE Chess
        </div>
        <div className="flex items-center">
          <Globe className="w-3.5 h-3.5 mr-2" /> Sinkronisasi Real-Time Turn
        </div>
        <div className="flex items-center">
          <Settings className="w-3.5 h-3.5 mr-2" /> Modul analisis AI Coach terintegrasi
        </div>
      </div>
    </div>
  );
};
