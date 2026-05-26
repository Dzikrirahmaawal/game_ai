/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ArrowLeft, Loader2, Play, Users, Check, Clock, ShieldAlert } from 'lucide-react';

interface OnlineLobbyProps {
  onBack: () => void;
  onRoomCreated: (roomCode: string, playerId: string, playerName: string) => void;
  onRoomJoined: (roomCode: string, playerId: string, playerName: string) => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onBack, onRoomCreated, onRoomJoined }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [timerMinutes, setTimerMinutes] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load saved name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chess_player_name');
    if (saved) {
      setPlayerName(saved);
    }
  }, []);

  const saveName = (name: string) => {
    localStorage.setItem('chess_player_name', name);
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Silakan tulis nama Anda terlebih dahulu.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    saveName(playerName);

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, timerMinutes }),
      });
      const data = await response.json();

      if (response.ok && data.id) {
        onRoomCreated(data.id, data.whitePlayer.id, playerName);
      } else {
        setErrorMessage(data.error || 'Gagal membuat ruang permainan.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Koneksi server gagal. Pastikan server telah aktif.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Silakan tulis nama Anda terlebih dahulu.');
      return;
    }
    if (!roomCodeInput.trim() || roomCodeInput.length !== 6) {
      setErrorMessage('Masukkan 6-karakter kode room yang valid.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    saveName(playerName);
    const code = roomCodeInput.toUpperCase().trim();

    try {
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      });
      const data = await response.json();

      if (response.ok && data.id) {
        onRoomJoined(data.id, data.blackPlayer.id, playerName);
      } else {
        setErrorMessage(data.error || 'Gagal masuk ke ruang catur. Periksa kembali kode.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Gagal terhubung dengan room. Periksa apakah kode room benar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="online-lobby-root" className="w-full max-w-xl mx-auto px-4 py-12">
      <motion.button
        whileHover={{ x: -3 }}
        onClick={onBack}
        className="mb-8 flex items-center text-xs font-mono font-black uppercase tracking-widest text-white hover:opacity-85 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali ke Pilihan Mode
      </motion.button>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-[#0F0F0F] border border-[#222] rounded-none p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-white"></div>
        
        {/* Lobby Header */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 rounded-none bg-white flex items-center justify-center text-black font-black">
            <Globe className="w-5 h-5 text-black animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase">Multiplayer Online</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Hubungkan pertandingan Anda bersama teman secara realtime.</p>
          </div>
        </div>

        {/* Input Player Name */}
        <div className="mb-6">
          <label className="text-[9px] font-black text-gray-500 block mb-2 font-mono uppercase tracking-widest">
            Nama Anda (Sebagai Pemain)
          </label>
          <input
            type="text"
            placeholder="NAMA ALIAS..."
            maxLength={18}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 rounded-none border border-[#333] bg-[#0A0A0A] text-white focus:outline-none focus:border-white font-black text-xs uppercase tracking-widest transition-all"
          />
        </div>

        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 p-3 bg-[#111] border border-red-500/40 text-red-400 text-xs rounded-none flex items-center space-x-2 font-mono uppercase tracking-wider"
            >
              <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divide sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[#222]">
          
          {/* Create Room Box */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center pb-1.5 border-b border-[#222]">
              <span className="w-1.5 h-1.5 bg-white mr-2"></span> Buat Room Baru
            </h3>
            
            <div>
              <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1.5 tracking-widest">
                Waktu Catur:
              </label>
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-none border border-[#333] bg-[#0A0A0A] text-xs text-white uppercase tracking-wider font-mono focus:outline-none focus:border-white"
              >
                <option value={5}>Blitz (5 Menit)</option>
                <option value={10}>Standard (10 Menit)</option>
                <option value={15}>Rapid (15 Menit)</option>
                <option value={30}>Classical (30 Menit)</option>
              </select>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full h-11 bg-[#222] hover:bg-[#333] text-white border border-[#444] rounded-none font-black flex items-center justify-center text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 stroke-current animate-spin mr-1.5" />
              ) : (
                <Play className="w-3 h-3 fill-current mr-1.5" />
              )}
              Host Room Catur
            </button>
          </div>

          {/* Join Room Box */}
          <div className="space-y-4 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-[#222] md:pl-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center pb-1.5 border-b border-[#222] mb-3">
                <span className="w-1.5 h-1.5 bg-white mr-2"></span> Gabung Room Teman
              </h3>
              
              <label className="text-[9px] text-gray-500 font-mono uppercase block mb-1.5 tracking-widest">
                Masukkan Kode Room (6-Digit):
              </label>
              <input
                type="text"
                placeholder="AKJ8Y9"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-none border border-[#333] bg-[#0A0A0A] text-center font-mono text-sm tracking-[0.25em] text-white font-black uppercase focus:outline-none focus:border-white"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={isLoading}
              className="w-full h-11 bg-white hover:bg-gray-200 text-black rounded-none font-black flex items-center justify-center text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 stroke-current animate-spin mr-1.5 text-black" />
              ) : (
                <Users className="w-3.5 h-3.5 mr-1.5 text-black" />
              )}
              Masuk Room Catur
            </button>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
