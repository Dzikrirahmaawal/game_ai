/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chess } from 'chess.js';
import { 
  Bot, Swords, Globe, Send, RefreshCw, LogOut, ArrowLeft,
  ChevronRight, Volume2, ShieldAlert, Sparkles, MessageSquare, ListTodo, Trophy, BadgeAlert
} from 'lucide-react';

import { GameMode, BotDifficulty, Player, ChessTimer, ChessMoveRecord, ChatMessage } from './types';
import { GameModes } from './components/GameModes';
import { OnlineLobby } from './components/OnlineLobby';
import { ChessBoard } from './components/ChessBoard';
import { ChessClock } from './components/ChessClock';
import { AICoach } from './components/AICoach';
import { generateRoomCode } from './utils';

// Maps piece symbols to Unicode characters for captured piece tray
const UNICODE_PIECES: { [key: string]: string } = {
  q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

export default function App() {
  // Game Setup States
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [lobbyActive, setLobbyActive] = useState(false);
  
  // Game Status States
  const [boardFen, setBoardFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [turnColor, setTurnColor] = useState<'w' | 'b'>('w');
  const [roomStatus, setRoomStatus] = useState<'lobby' | 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout'>('playing');
  const [winner, setWinner] = useState<'w' | 'b' | null>(null);
  
  // Players States
  const [selfPlayerId, setSelfPlayerId] = useState<string | null>(null);
  const [selfPlayerName, setSelfPlayerName] = useState('Pemain Utama');
  
  // Bot match specific configurations
  const [aiDifficulty, setAiDifficulty] = useState<BotDifficulty>('medium');
  const [aiPlayerColor, setAiPlayerColor] = useState<'w' | 'b'>('w'); // 'w' means player is white, black is computer
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [botBanter, setBotBanter] = useState<string | null>('Halo! Bersiaplah untuk menyerah di hadapan kehebatanku!');

  // Matchmaking/Online room states
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [onlineWhitePlayer, setOnlineWhitePlayer] = useState<Player | null>(null);
  const [onlineBlackPlayer, setOnlineBlackPlayer] = useState<Player | null>(null);
  
  // Common states
  const [moveHistory, setMoveHistory] = useState<ChessMoveRecord[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputField, setChatInputField] = useState('');
  const [timerClock, setTimerClock] = useState<ChessTimer>({
    whiteTimeSec: 600,
    blackTimeSec: 600,
    initialTimeSec: 600,
    lastTickTimestamp: null,
    isRunning: false,
  });

  // UI Highlight Square
  const [coachHighlightedMove, setCoachHighlightedMove] = useState<{ from: string; to: string } | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'moves' | 'chat'>('moves');

  const bottomChatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat log to bottom whenever chat grows
  useEffect(() => {
    if (bottomChatScrollRef.current) {
      bottomChatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Online Room Sync (Polls roomId status every 2 seconds)
  useEffect(() => {
    if (gameMode !== 'online' || !activeRoomId) return;

    const pullRoomState = async () => {
      try {
        const res = await fetch(`/api/rooms/${activeRoomId}`);
        if (res.ok) {
          const data = await res.json();
          setBoardFen(data.fen);
          setTurnColor(data.turn);
          setRoomStatus(data.status);
          setWinner(data.winner);
          setMoveHistory(data.moves);
          setChatMessages(data.chat);
          setOnlineWhitePlayer(data.whitePlayer);
          setOnlineBlackPlayer(data.blackPlayer);
          setTimerClock({
            whiteTimeSec: data.timer.whiteTimeSec,
            blackTimeSec: data.timer.blackTimeSec,
            initialTimeSec: data.timer.initialTimeSec,
            lastTickTimestamp: data.timer.lastTickTimestamp,
            isRunning: data.timer.isRunning,
          });
        }
      } catch (err) {
        console.error('Room sync pulling failed:', err);
      }
    };

    pullRoomState(); // Immediate pull
    const interval = setInterval(pullRoomState, 2000);
    return () => clearInterval(interval);
  }, [gameMode, activeRoomId]);

  // Heartbeat online presence (every 4 seconds)
  useEffect(() => {
    if (gameMode !== 'online' || !activeRoomId || !selfPlayerId) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`/api/rooms/${activeRoomId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: selfPlayerId }),
        });
      } catch (err) {
        console.warn('Heartbeat reporting connection offline.');
      }
    };

    const interval = setInterval(sendHeartbeat, 4000);
    return () => clearInterval(interval);
  }, [gameMode, activeRoomId, selfPlayerId]);

  // Trigger BOT calculation offline/online during its turn
  useEffect(() => {
    if (gameMode !== 'ai' || roomStatus !== 'playing') return;

    const isBotTurn = turnColor === (aiPlayerColor === 'w' ? 'b' : 'w');
    if (isBotTurn && !isBotThinking) {
      setIsBotThinking(true);
      
      const decideAndExecuteMove = async () => {
        try {
          const response = await fetch('/api/gemini/bot-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fen: boardFen,
              moves: moveHistory,
              botColor: aiPlayerColor === 'w' ? 'b' : 'w',
              botDifficulty: aiDifficulty,
            }),
          });
          
          const result = await response.json();
          if (response.ok && result.bestMove) {
            // Apply move
            const gameObj = new Chess(boardFen);
            const verifiedMove = gameObj.move({
              from: result.bestMove.from,
              to: result.bestMove.to,
              promotion: 'q',
            });
            
            setBoardFen(gameObj.fen());
            setTurnColor(gameObj.turn());
            
            const record: ChessMoveRecord = {
              san: verifiedMove.san,
              from: result.bestMove.from,
              to: result.bestMove.to,
              piece: verifiedMove.piece,
              color: verifiedMove.color,
              timestamp: Date.now(),
            };
            
            setMoveHistory((prev) => [...prev, record]);
            if (result.comment) {
              setBotBanter(result.comment);
            }

            // check offline end states
            if (gameObj.isCheckmate()) {
              setRoomStatus('checkmate');
              setWinner(verifiedMove.color);
            } else if (gameObj.isDraw()) {
              setRoomStatus('draw');
            }
          }
        } catch (err) {
          console.error('Error receiving bot decision:', err);
        } finally {
          setIsBotThinking(false);
        }
      };

      // Delay a little for chess pieces glide transitions
      const delay = setTimeout(decideAndExecuteMove, 1000);
      return () => clearTimeout(delay);
    }
  }, [gameMode, turnColor, boardFen, aiPlayerColor, roomStatus, isBotThinking]);

  // Mode Selection Triggers
  const handleSelectMode = (mode: GameMode, botDiff?: BotDifficulty, chosenColor?: 'w' | 'b' | 'random') => {
    setGameMode(mode);
    setLobbyActive(false);
    setBoardFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setTurnColor('w');
    setRoomStatus('playing');
    setWinner(null);
    setMoveHistory([]);
    setCoachHighlightedMove(null);

    if (mode === 'ai') {
      if (botDiff) setAiDifficulty(botDiff);
      
      let actualColor: 'w' | 'b' = 'w';
      if (chosenColor === 'random') {
        actualColor = Math.random() > 0.5 ? 'w' : 'b';
      } else if (chosenColor) {
        actualColor = chosenColor;
      }
      setAiPlayerColor(actualColor);

      // Reset timers for bot game (10 min rapid standard)
      setTimerClock({
        whiteTimeSec: 600,
        blackTimeSec: 600,
        initialTimeSec: 600,
        lastTickTimestamp: Date.now(),
        isRunning: true,
      });

      // Quick bot welcome dialogue
      setBotBanter(
        botDiff === 'gemini' 
          ? 'Salam kenal! Saya adalah Gemini AI Chess Rival. Letakkan bidak pertamamu, mari asah pikiran lewat pertempuran kotak hitam putih!'
          : 'Halo! Bot taktis diaktifkan. Kalahkan aku jika kau mampu!'
      );
    } else if (mode === 'local') {
      setTimerClock({
        whiteTimeSec: 600,
        blackTimeSec: 600,
        initialTimeSec: 600,
        lastTickTimestamp: Date.now(),
        isRunning: true,
      });
    }
  };

  // Online Host/Creation Trigger
  const handleRoomCreated = (roomCode: string, pId: string, pName: string) => {
    setActiveRoomId(roomCode);
    setSelfPlayerId(pId);
    setSelfPlayerName(pName);
    setGameMode('online');
    setLobbyActive(false);
    setRightPanelTab('chat');
  };

  // Online Join Trigger
  const handleRoomJoined = (roomCode: string, pId: string, pName: string) => {
    setActiveRoomId(roomCode);
    setSelfPlayerId(pId);
    setSelfPlayerName(pName);
    setGameMode('online');
    setLobbyActive(false);
    setRightPanelTab('chat');
  };

  // Move Submissions
  const handleMoveSelection = async (from: string, to: string, promotion?: string) => {
    // 1. If Online Mode
    if (gameMode === 'online') {
      try {
        const response = await fetch(`/api/rooms/${activeRoomId}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: selfPlayerId,
            from,
            to,
            promotion,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setBoardFen(data.fen);
          setTurnColor(data.turn);
          setRoomStatus(data.status);
          setWinner(data.winner);
          setMoveHistory(data.moves);
          setChatMessages(data.chat);
        } else {
          alert(data.error || 'Langkah dilarang.');
        }
      } catch (err) {
        console.error('Move submission error:', err);
      }
      return;
    }

    // 2. If LAN/Offline Manual modes (Local & Bot)
    try {
      const chessObj = new Chess(boardFen);
      const resMove = chessObj.move({ from, to, promotion: promotion || 'q' });
      
      const nextFen = chessObj.fen();
      setBoardFen(nextFen);
      
      const nextTurn = chessObj.turn();
      setTurnColor(nextTurn);
      setCoachHighlightedMove(null); // delete guidance highlight

      const record: ChessMoveRecord = {
        san: resMove.san,
        from,
        to,
        piece: resMove.piece,
        color: resMove.color,
        timestamp: Date.now(),
      };
      setMoveHistory((prev) => [...prev, record]);

      // Check end states
      if (chessObj.isCheckmate()) {
        setRoomStatus('checkmate');
        setWinner(resMove.color);
        setTimerClock((prev) => ({ ...prev, isRunning: false }));
      } else if (chessObj.isDraw()) {
        setRoomStatus('draw');
        setTimerClock((prev) => ({ ...prev, isRunning: false }));
      }
    } catch (e) {
      console.warn('Langkah tidak sesuai aturan.');
    }
  };

  // Resignation Trigger
  const handleResignedMatch = async () => {
    if (window.confirm('Apakah Anda yakin ingin menyerah dalam pertandingan ini?')) {
      if (gameMode === 'online') {
        try {
          await fetch(`/api/rooms/${activeRoomId}/resign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: selfPlayerId }),
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        setRoomStatus('resigned');
        setWinner(aiPlayerColor === 'w' ? 'b' : 'w'); // player is resigning, computer wins
        setTimerClock((p) => ({ ...p, isRunning: false }));
      }
    }
  };

  // Timeout handler (for offline and bot modes)
  const handleTimeout = (loser: 'w' | 'b') => {
    setRoomStatus('timeout');
    setWinner(loser === 'w' ? 'b' : 'w');
    setTimerClock((prev) => ({ ...prev, isRunning: false }));
  };

  // Local clock sync ticks
  const handleLocalTick = (whiteTime: number, blackTime: number) => {
    setTimerClock((prev) => ({
      ...prev,
      whiteTimeSec: whiteTime,
      blackTimeSec: blackTime,
    }));
  };

  // Sending Multiplayer Chat
  const handleSendChat = async () => {
    if (!chatInputField.trim()) return;

    if (gameMode === 'online') {
      try {
        const response = await fetch(`/api/rooms/${activeRoomId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: selfPlayerId,
            playerName: selfPlayerName,
            text: chatInputField,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setChatMessages(data.chat);
          setChatInputField('');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Offline fallback chats
      const mockMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        senderId: 'player',
        senderName: selfPlayerName,
        text: chatInputField,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, mockMsg]);
      setChatInputField('');

      // If playing with Gemini Bot, make it reply!
      if (gameMode === 'ai' && aiDifficulty === 'gemini') {
        setTimeout(async () => {
          try {
            const botResponse = await fetch('/api/gemini/bot-move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fen: boardFen,
                moves: moveHistory,
                botColor: aiPlayerColor === 'w' ? 'b' : 'w',
                botDifficulty: aiDifficulty,
              }),
            });
            const result = await botResponse.json();
            if (botResponse.ok && result.comment) {
              setBotBanter(result.comment);
            }
          } catch (e) {
            console.warn('Bot commentary failed to speak');
          }
        }, 1200);
      }
    }
  };

  // Exit game to main menu
  const handleExitMatch = () => {
    if (window.confirm('Keluar dari permainan dan kembali ke menu utama?')) {
      setGameMode(null);
      setLobbyActive(false);
      setActiveRoomId(null);
      setSelfPlayerId(null);
      setMoveHistory([]);
      setChatMessages([]);
      setCoachHighlightedMove(null);
    }
  };

  // Calculate captured pieces dynamically
  const getCaptures = () => {
    const counts = { w: { p:0, n:0, b:0, r:0, q:0, k:0 }, b: { p:0, n:0, b:0, r:0, q:0, k:0 } };
    try {
      const chessObj = new Chess(boardFen);
      chessObj.board().forEach(row => row.forEach(sq => {
        if (sq) {
          counts[sq.color as 'w' | 'b'][sq.type as 'p'|'n'|'b'|'r'|'q'|'k']++;
        }
      }));
    } catch {
      // fallback
    }

    const initial = { p:8, n:2, b:2, r:2, q:1, k:1 };
    const capturedWhite: string[] = []; // white pieces captured (by Black)
    const capturedBlack: string[] = []; // black pieces captured (by White)

    const piecesOrder: ('q'|'r'|'b'|'n'|'p')[] = ['q', 'r', 'b', 'n', 'p'];
    
    piecesOrder.forEach(p => {
      const wCap = initial[p] - counts.w[p];
      for (let i = 0; i < wCap; i++) capturedWhite.push(p);

      const bCap = initial[p] - counts.b[p];
      for (let i = 0; i < bCap; i++) capturedBlack.push(p);
    });

    return { white: capturedWhite, black: capturedBlack };
  };

  const currentCaptures = getCaptures();

  // Score differentials based on standard piece weights
  const getScoreLeader = () => {
    const scores = { q:9, r:5, b:3, n:3, p:1 };
    let whiteSum = 0;
    let blackSum = 0;

    currentCaptures.white.forEach(p => { whiteSum += scores[p as 'q'|'r'|'b'|'n'|'p'] || 0; });
    currentCaptures.black.forEach(p => { blackSum += scores[p as 'q'|'r'|'b'|'n'|'p'] || 0; });

    // white captured means Black has them. black captured means White has them.
    const whiteLead = blackSum - whiteSum; // Positif means White leads, Negatif means Black leads
    return whiteLead;
  };

  const scoreDiff = getScoreLeader();


  // --- RENDERING ROUTER ---

  // 1. Render Main Menu (Mode Selection)
  if (!gameMode && !lobbyActive) {
    return (
      <div className="min-h-screen bg-[#10131A] text-gray-100 flex flex-col justify-between py-12">
        <GameModes 
          onSelectMode={handleSelectMode} 
          onOpenMultiplayer={() => setLobbyActive(true)} 
        />
        <footer className="text-center text-[11px] text-gray-500 font-sans mt-8">
          Arena Chess Online &amp; AI Engine © 2026. Semua aturan catur FIDE didukung secara mekanis.
        </footer>
      </div>
    );
  }

  // 2. Render Lobby Matchmaking
  if (lobbyActive) {
    return (
      <div className="min-h-screen bg-[#10131A] text-gray-100 flex flex-col justify-center py-12">
        <OnlineLobby 
          onBack={() => setLobbyActive(false)} 
          onRoomCreated={handleRoomCreated} 
          onRoomJoined={handleRoomJoined} 
        />
      </div>
    );
  }

  // Define player identities in match for high-fidelity display
  const getMatchPlayersIdentities = () => {
    if (gameMode === 'online') {
      const whiteName = onlineWhitePlayer ? onlineWhitePlayer.name : 'Menunggu...';
      const blackName = onlineBlackPlayer ? onlineBlackPlayer.name : 'Menunggu...';
      const whiteOnline = onlineWhitePlayer?.isOnline || false;
      const blackOnline = onlineBlackPlayer?.isOnline || false;
      
      return {
        white: { name: whiteName, isOnline: whiteOnline, id: onlineWhitePlayer?.id },
        black: { name: blackName, isOnline: blackOnline, id: onlineBlackPlayer?.id }
      };
    } else if (gameMode === 'ai') {
      const isPlayerWhite = aiPlayerColor === 'w';
      const botLabel = `Komputer Bot (${
        aiDifficulty === 'easy' ? 'Pemula' :
        aiDifficulty === 'medium' ? 'Menengah' :
        aiDifficulty === 'hard' ? 'Suhu' : 'Gemini AI ✨'
      })`;
      
      return {
        white: { name: isPlayerWhite ? selfPlayerName : botLabel, isOnline: true },
        black: { name: !isPlayerWhite ? selfPlayerName : botLabel, isOnline: true }
      };
    } else { // local
      return {
        white: { name: 'Pemain 1 (Putih)', isOnline: true },
        black: { name: 'Pemain 2 (Hitam)', isOnline: true }
      };
    }
  };

  const matchPlayers = getMatchPlayersIdentities();
  const isOnlineLobbyState = gameMode === 'online' && !onlineBlackPlayer;

  // Let's render the immersive Chess Game Arena!
  return (
    <div id="game-arena-root" className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] flex flex-col font-sans">
      
      {/* Upper Navigation Rail */}
      <header className="bg-[#0F0F0F] border-b border-[#222] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={handleExitMatch}
            className="px-3 py-1.5 bg-[#222] border border-[#333] text-xs font-mono font-black uppercase tracking-widest hover:bg-[#333] text-white hover:border-[#444] transition-all cursor-pointer"
            title="Kembali ke Menu Utama"
          >
            ← MENU
          </button>
          <div className="h-5 w-[1px] bg-[#222]"></div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-white uppercase tracking-widest font-black">
                {gameMode === 'local' && 'Mode Pass & Play'}
                {gameMode === 'ai' && `Bertanding vs Bot (${aiDifficulty})`}
                {gameMode === 'online' && `Online Room: ${activeRoomId}`}
              </span>
              {gameMode === 'online' && (
                <span className="w-1.5 h-1.5 rounded-none bg-white animate-ping"></span>
              )}
            </div>
            {gameMode === 'online' && (
              <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Room Code: <b className="text-white select-all">{activeRoomId}</b></p>
            )}
          </div>
        </div>

        {gameMode === 'online' && isOnlineLobbyState && (
          <div className="hidden md:flex items-center space-x-2 text-[9px] font-mono uppercase tracking-widest bg-white text-black px-3.5 h-9 font-black animate-pulse">
            <Globe className="w-3.5 h-3.5 text-black" />
            <span>Menunggu lawan bergabung...</span>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <button
            onClick={handleResignedMatch}
            disabled={roomStatus !== 'playing'}
            className="px-4 py-1.5 bg-transparent hover:bg-red-950/20 text-red-500 border border-red-950/40 rounded-none text-[10px] font-mono font-black uppercase tracking-widest transition-all disabled:opacity-40 cursor-pointer"
          >
            Menyerah 🏳️
          </button>
        </div>
      </header>

      {/* Main split dashboard screen layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Board and Clocks (Col 1-7) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Opponent Profile HUD */}
          <div className="bg-[#0F0F0F] border border-[#222] rounded-none p-3.5 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-none flex items-center justify-center font-black ${
                  turnColor === 'b' ? 'bg-white text-black' : 'bg-[#222] text-[#888]'
                }`}>
                  {turnColor === 'b' ? '♟' : '♙'}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-none border border-[#0F0F0F] ${
                  matchPlayers.black.isOnline ? 'bg-white' : 'bg-[#555]'
                }`}></span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-sans font-black text-white text-xs uppercase tracking-widest">{matchPlayers.black.name}</h4>
                  <span className="text-[9px] bg-[#222] text-white/60 px-1.5 py-0.5 font-mono uppercase tracking-widest">HITAM</span>
                </div>
                {/* Black captures displayed as White material advantage */}
                <div className="flex items-center space-x-1 mt-1 text-xs">
                  <div className="flex text-gray-500 tracking-tighter text-sm font-sans font-medium">
                    {currentCaptures.black.map((p, idx) => (
                      <span key={idx} className="mr-0.5 transition-all" title={`Black Piece captured: ${p}`}>
                        {UNICODE_PIECES[p]}
                      </span>
                    ))}
                  </div>
                  {scoreDiff < 0 && (
                    <span className="text-[9px] text-white font-mono font-black bg-[#222] border border-[#333] px-1.5 py-0.5">
                      +{Math.abs(scoreDiff)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Turn status capsule */}
            {turnColor === 'b' && roomStatus === 'playing' && (
              <span className="px-3 py-1 bg-white text-black text-[9px] font-mono font-black border-none rounded-none uppercase tracking-widest animate-pulse">
                Melangkah ⚡
              </span>
            )}
          </div>

          {/* Interactive Core Chessboard Frame */}
          <div className="relative bg-[#0F0F0F] p-4 border border-[#222] rounded-none flex items-center justify-center">
            
            <ChessBoard
              fen={boardFen}
              playerColor={gameMode === 'local' ? 'both' : (aiPlayerColor as any)}
              activeColor={turnColor}
              interactive={roomStatus === 'playing' && !isBotThinking && (
                gameMode !== 'online' || 
                (turnColor === 'w' && selfPlayerId === onlineWhitePlayer?.id) || 
                (turnColor === 'b' && selfPlayerId === onlineBlackPlayer?.id)
              )}
              highlightedMove={coachHighlightedMove}
              onMove={handleMoveSelection}
              gameStatus={roomStatus}
            />

            {/* Game Over Screen Overlay inside the board frame */}
            {roomStatus !== 'playing' && roomStatus !== 'lobby' && (
              <div className="absolute inset-0 bg-[#0A0A0A]/98 z-30 rounded-none flex flex-col items-center justify-center p-6 text-center border border-[#333]">
                <div className="w-14 h-14 bg-white text-black rounded-none flex items-center justify-center text-black mb-4">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white tracking-widest uppercase">Permainan Berakhir!</h3>
                <p className="text-xs font-mono uppercase tracking-wider mt-3 max-w-sm ml-auto mr-auto text-gray-300 bg-[#0F0F0F] p-3.5 rounded-none border border-[#222]">
                  {roomStatus === 'checkmate' && `SKAKMAT JALAN KELUAR! Pemenang: ${winner === 'w' ? 'Putih' : 'Hitam'}`}
                  {roomStatus === 'resigned' && `Permainan selesai: Pengunduran Diri. Pemenang: ${winner === 'w' ? 'Putih' : 'Hitam'}`}
                  {roomStatus === 'stalemate' && `Remis: Keadaan Stalemate (Raja terkunci tanpa skak).`}
                  {roomStatus === 'draw' && `Pertandingan Seri (Draw/Remis).`}
                  {roomStatus === 'timeout' && `Waktu habis! Pemenang: ${winner === 'w' ? 'Putih' : 'Hitam'}`}
                </p>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => handleSelectMode(gameMode, aiDifficulty, aiPlayerColor)}
                    className="px-5 py-2.5 bg-white hover:bg-gray-250 text-black rounded-none font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Tanding Ulang 🔄
                  </button>
                  <button
                    onClick={handleExitMatch}
                    className="px-5 py-2.5 bg-[#222] text-white border border-[#333] hover:bg-[#333] rounded-none font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Menu Utama 🏠
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Player Profile HUD */}
          <div className="bg-[#0F0F0F] border border-[#222] rounded-none p-3.5 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-none flex items-center justify-center font-black ${
                  turnColor === 'w' ? 'bg-white text-black' : 'bg-[#222] text-[#888]'
                }`}>
                  {turnColor === 'w' ? '♟' : '♙'}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-none border border-[#0F0F0F] ${
                  matchPlayers.white.isOnline ? 'bg-white' : 'bg-[#555]'
                }`}></span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-sans font-black text-white text-xs uppercase tracking-widest">
                    {matchPlayers.white.name} {gameMode === 'online' && selfPlayerId === onlineWhitePlayer?.id && ' (Anda)'}
                  </h4>
                  <span className="text-[9px] bg-[#222] text-white/60 px-1.5 py-0.5 font-mono uppercase tracking-widest">PUTIH</span>
                </div>
                {/* White captures displayed as Black material advantage */}
                <div className="flex items-center space-x-1 mt-1 text-xs">
                  <div className="flex text-gray-500 tracking-tighter text-sm font-sans font-medium">
                    {currentCaptures.white.map((p, idx) => (
                      <span key={idx} className="mr-0.5 transition-all text-white" title={`White Piece captured: ${p}`}>
                        {UNICODE_PIECES[p]}
                      </span>
                    ))}
                  </div>
                  {scoreDiff > 0 && (
                    <span className="text-[9px] text-white font-mono font-black bg-[#222] border border-[#333] px-1.5 py-0.5">
                      +{scoreDiff}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {turnColor === 'w' && roomStatus === 'playing' && (
              <span className="px-3 py-1 bg-white text-black text-[9px] font-mono font-black border-none rounded-none uppercase tracking-widest animate-pulse">
                Melangkah ⚡
              </span>
            )}
          </div>

          {/* Match Hour Clocks */}
          <ChessClock
            whiteTimeSec={timerClock.whiteTimeSec}
            blackTimeSec={timerClock.blackTimeSec}
            activeColor={turnColor}
            gameStatus={roomStatus}
            onTimeout={handleTimeout}
            isOnlineMode={gameMode === 'online'}
            onTickLocal={handleLocalTick}
          />

        </div>

        {/* Right column: Bot banter & Move log & Chat Messaging & Coach AI (Col 8-12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Bot Banter Dialogue (Rendered only on AI Opponent mode) */}
          {gameMode === 'ai' && (
            <div className="bg-[#0F0F0F] border border-[#222] rounded-none p-4 relative overflow-hidden flex items-start space-x-3 font-sans">
              <div className="w-9 h-9 bg-[#222] border border-[#333] text-white flex items-center justify-center relative flex-shrink-0">
                <Bot className={`w-5 h-5 ${isBotThinking ? 'animate-pulse' : ''}`} />
                {isBotThinking && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-none bg-white"></span>
                )}
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="text-[9px] text-white font-mono uppercase tracking-widest block font-black">
                  {aiDifficulty === 'gemini' ? 'Gemini AI Rival' : 'Mesin Catur Heuristik'}
                </span>
                <p className="text-xs text-gray-300 italic min-h-[30px] font-medium leading-relaxed">
                  {isBotThinking ? 'Menganalisis papan catur taktis...' : `"${botBanter || 'Ayolah melangkah, aku menantang taktismu!'}"`}
                </p>
              </div>
            </div>
          )}

          {/* Double Grid Tabs: Moves / Chat */}
          <div className="bg-[#0F0F0F] border border-[#222] rounded-none shadow-xl overflow-hidden flex flex-col h-[320px]">
            {/* Header switcher */}
            <div className="bg-[#0A0A0A] border-b border-[#222] grid grid-cols-2">
              <button
                onClick={() => setRightPanelTab('moves')}
                className={`py-3 text-[10px] font-mono font-black uppercase tracking-widest leading-none flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                  rightPanelTab === 'moves'
                    ? 'border-white text-white bg-[#0A0A0A]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Histori Langkah</span>
              </button>
              <button
                onClick={() => setRightPanelTab('chat')}
                className={`py-3 text-[10px] font-mono font-black uppercase tracking-widest leading-none flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                  rightPanelTab === 'chat'
                    ? 'border-white text-white bg-[#0A0A0A]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat Permainan</span>
              </button>
            </div>

            {/* Tab Body Contents */}
            <div className="flex-1 overflow-y-auto p-4 select-text">
              <AnimatePresence mode="wait">
                {rightPanelTab === 'moves' ? (
                  <motion.div
                    key="tab-moves"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 h-full"
                  >
                    {moveHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-45 py-12">
                        <BadgeAlert className="w-6 h-6 mb-2 text-gray-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Belum ada langkah tercatat.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                        {/* Group into standard pairs */}
                        {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, idx) => {
                          const wM = moveHistory[idx * 2];
                          const bM = moveHistory[idx * 2 + 1];
                          return (
                            <React.Fragment key={idx}>
                              <div className="bg-[#0A0A0A] p-2 border border-[#222] rounded-none flex items-center space-x-2 text-white/95">
                                <span className="text-white/40 font-mono font-black text-[10px] w-4">{idx + 1}.</span>
                                <span className="font-black text-xs">{wM.san}</span>
                                <span className="text-[9px] text-gray-500 lowercase font-mono ml-auto">({wM.from}→{wM.to})</span>
                              </div>
                              {bM ? (
                                <div className="bg-[#0A0A0A] p-2 border border-[#222] rounded-none flex items-center space-x-2 text-white/95">
                                  <span className="text-white/40 font-mono font-black text-[10px] w-4">{idx + 1}.</span>
                                  <span className="font-black text-xs">{bM.san}</span>
                                  <span className="text-[9px] text-gray-500 lowercase font-mono ml-auto">({bM.from}→{bM.to})</span>
                                </div>
                              ) : (
                                <div className="p-2 border border-dashed border-[#222] text-gray-600 font-mono text-[10px] uppercase tracking-widest">
                                  Menunggu...
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="tab-chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col h-full space-y-3"
                  >
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-[190px]">
                      {chatMessages.length === 0 ? (
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest text-center py-12">
                          Belum ada obrolan. Kirim pesan ke lawan Anda di bawah!
                        </p>
                      ) : (
                        chatMessages.map((msg) => {
                          const isSys = msg.senderId === 'system';
                          const isSelf = msg.senderId === selfPlayerId || msg.senderId === 'player';

                          if (isSys) {
                            return (
                              <div key={msg.id} className="text-center font-sans">
                                <span className="inline-block px-3 py-1 rounded-none bg-[#0A0A0A] text-[9px] text-gray-400 font-mono border border-[#222] leading-tight uppercase tracking-wider">
                                  📢 {msg.text}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col max-w-[85%] font-sans text-xs ${
                                isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                              }`}
                            >
                              <span className="text-[9px] text-gray-500 mb-0.5 px-0.5 font-mono uppercase tracking-wider">
                                {msg.senderName}
                              </span>
                              <div
                                className={`p-2.5 rounded-none ${
                                  isSelf
                                    ? 'bg-white text-black font-medium'
                                    : 'bg-[#111] border border-[#222] text-gray-300'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={bottomChatScrollRef} />
                    </div>

                    {/* Chat Input form bar */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-[#222]">
                      <input
                        type="text"
                        placeholder="KETIK PESAN..."
                        value={chatInputField}
                        onChange={(e) => setChatInputField(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendChat();
                        }}
                        className="flex-1 px-3 py-2 rounded-none border border-[#333] bg-[#0A0A0A] text-xs text-white uppercase font-mono tracking-widest focus:outline-none focus:border-white"
                      />
                      <button
                        onClick={handleSendChat}
                        className="w-9 h-9 bg-white text-black font-black flex items-center justify-center hover:bg-gray-250 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive tactical AI Coach panel */}
          <AICoach
            fen={boardFen}
            moveHistory={moveHistory}
            turn={turnColor}
            mode={gameMode}
            onHighlightMove={(from, to) => {
              setCoachHighlightedMove({ from, to });
              // Scroll board visual up on mobile if coach advice highlighted
              document.getElementById('chessboard-widget-container')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

        </div>

      </main>

      {/* Bottom Status Bar / Brutalist Footer */}
      <footer className="h-9 border-t border-[#222] bg-[#0A0A0A] flex items-center px-6 justify-between text-[8px] font-mono font-black uppercase tracking-[0.25em] text-gray-500 select-none">
        <div className="flex gap-6">
          <span>Version 2.5-Alpha</span>
          <span>Engine Status: Online</span>
        </div>
        <div className="flex gap-6 hidden sm:flex">
          <span>Real-time Sync Active</span>
          <span>© 2026 ChessMasters</span>
        </div>
      </footer>
    </div>
  );
}
