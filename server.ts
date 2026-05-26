/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Chess } from 'chess.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { ChessRoom, ChatMessage, Player, ChessMoveRecord } from './src/types';
import { OperationType, handleFirestoreError } from './src/lib/firestore-error';

// Load environment variables
dotenv.config();

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
const API_KEY = process.env.GEMINI_API_KEY;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini AI Client initialized successfully.');
  } catch (err) {
    console.error('Error initializing Gemini AI Client:', err);
  }
} else {
  console.warn('GEMINI_API_KEY is not defined. AI components will fall back to procedural responses.');
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firestore with Database ID from firebase-applet-config.json
let db: any = null;
const localRooms = new Map<string, ChessRoom>();

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log('Firebase App & Firestore successfully initialized in server.');
  } else {
    console.warn('firebase-applet-config.json not found. Falling back to local in-memory rooms.');
  }
} catch (err) {
  console.error('Failed to initialize Firebase SDK:', err);
}

// 1. Fetch Room from DB (with fallback to local Map)
async function getRoom(id: string): Promise<ChessRoom | null> {
  if (!db) {
    return localRooms.get(id) || null;
  }
  try {
    const snap = await getDoc(doc(db, 'rooms', id));
    if (snap.exists()) {
      return snap.data() as ChessRoom;
    }
    return null;
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
      handleFirestoreError(err, OperationType.GET, `rooms/${id}`);
    }
    console.error(`Error fetching room ${id} from Firestore:`, err);
    return null;
  }
}

// 2. Save Room to DB (with fallback to local Map)
async function saveRoom(id: string, room: ChessRoom, operation: OperationType = OperationType.WRITE): Promise<void> {
  if (!db) {
    localRooms.set(id, room);
    return;
  }
  try {
    await setDoc(doc(db, 'rooms', id), room);
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
      handleFirestoreError(err, operation, `rooms/${id}`);
    }
    console.error(`Error saving room ${id} to Firestore:`, err);
    throw err;
  }
}

// Helper to construct response with standard structural headers
const respondWithError = (res: express.Response, status: number, message: string) => {
  res.status(status).json({ success: false, error: message });
};

// --- MULTIPLAYER ROOM PATHS ---

// 1. Create Room
app.post('/api/rooms', async (req, res) => {
  const { playerName, timerMinutes } = req.body;
  if (!playerName) {
    return respondWithError(res, 400, 'Nama pemain wajib diisi');
  }

  const initialSec = (timerMinutes && timerMinutes >= 1 && timerMinutes <= 60) ? timerMinutes * 60 : 600; // default 10 min
  
  // Generate a clean 6-digit room code
  let roomCode = '';
  const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let isCodeUnique = false;
  do {
    roomCode = '';
    for (let i = 0; i < 6; i++) {
      roomCode += pool.charAt(Math.floor(Math.random() * pool.length));
    }
    const existing = await getRoom(roomCode);
    isCodeUnique = !existing;
  } while (!isCodeUnique);

  const whitePlayer: Player = {
    id: 'p_white_' + Math.random().toString(36).substring(2, 9),
    name: playerName,
    color: 'w',
    isOnline: true,
  };

  const newRoom: ChessRoom = {
    id: roomCode,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    status: 'lobby',
    winner: null,
    whitePlayer,
    blackPlayer: null,
    moves: [],
    chat: [
      {
        id: 'welcome_' + Date.now(),
        senderId: 'system',
        senderName: 'Sistem',
        text: `Room ${roomCode} dibuat oleh ${playerName}. Bagikan kode room ini kepada temanmu!`,
        timestamp: Date.now(),
      }
    ],
    createdAt: Date.now(),
    lastMovedAt: Date.now(),
    timer: {
      whiteTimeSec: initialSec,
      blackTimeSec: initialSec,
      initialTimeSec: initialSec,
      lastTickTimestamp: null,
      isRunning: false,
    },
  };

  try {
    await saveRoom(roomCode, newRoom, OperationType.CREATE);
    res.json(newRoom);
  } catch (err) {
    respondWithError(res, 500, 'Gagal membuat room di database');
  }
});

// 2. Join Room
app.post('/api/rooms/:id/join', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const { playerName } = req.body;
  
  if (!playerName) {
    return respondWithError(res, 400, 'Nama pemain wajib diisi');
  }

  const room = await getRoom(code);
  if (!room) {
    return respondWithError(res, 404, 'Room Chess tidak ditemukan atau kode salah');
  }

  if (room.whitePlayer && room.blackPlayer) {
    return respondWithError(res, 400, 'Room penuh! Maksimal 2 pemain');
  }

  // Assign color
  const blackPlayer: Player = {
    id: 'p_black_' + Math.random().toString(36).substring(2, 9),
    name: playerName,
    color: 'b',
    isOnline: true,
  };

  room.blackPlayer = blackPlayer;
  room.status = 'playing';
  room.lastMovedAt = Date.now();
  room.timer.lastTickTimestamp = Date.now();
  room.timer.isRunning = true;

  room.chat.push({
    id: 'join_' + Date.now(),
    senderId: 'system',
    senderName: 'Sistem',
    text: `${playerName} bergabung sebagai Hitam. Permainan dimulai!`,
    timestamp: Date.now(),
  });

  try {
    await saveRoom(code, room, OperationType.UPDATE);
    res.json(room);
  } catch (err) {
    respondWithError(res, 500, 'Gagal memperbarui data room di database');
  }
});

// 3. Get Room Info (with simple countdown math to keep clocks exact)
app.get('/api/rooms/:id', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const room = await getRoom(code);
  if (!room) {
    return respondWithError(res, 404, 'Room tidak ditemukan');
  }

  // Update timer in database if running
  let hasTimerChanged = false;
  if (room.status === 'playing' && room.timer.isRunning && room.timer.lastTickTimestamp) {
    const elapMs = Date.now() - room.timer.lastTickTimestamp;
    const elapSec = Math.floor(elapMs / 1000);
    
    if (elapSec > 0) {
      hasTimerChanged = true;
      if (room.turn === 'w') {
        room.timer.whiteTimeSec = Math.max(0, room.timer.whiteTimeSec - elapSec);
        if (room.timer.whiteTimeSec === 0) {
          room.status = 'timeout';
          room.winner = 'b';
          room.timer.isRunning = false;
          room.chat.push({
            id: 'timeout_' + Date.now(),
            senderId: 'system',
            senderName: 'Sistem',
            text: 'Waktu Putih habis! Hitam memenangkan permainan.',
            timestamp: Date.now(),
          });
        }
      } else {
        room.timer.blackTimeSec = Math.max(0, room.timer.blackTimeSec - elapSec);
        if (room.timer.blackTimeSec === 0) {
          room.status = 'timeout';
          room.winner = 'w';
          room.timer.isRunning = false;
          room.chat.push({
            id: 'timeout_' + Date.now(),
            senderId: 'system',
            senderName: 'Sistem',
            text: 'Waktu Hitam habis! Putih memenangkan permainan.',
            timestamp: Date.now(),
          });
        }
      }
      room.timer.lastTickTimestamp = room.timer.lastTickTimestamp + elapSec * 1000;
    }
  }

  if (hasTimerChanged) {
    try {
      await saveRoom(code, room, OperationType.UPDATE);
    } catch (err) {
      console.warn('Silent timer update failure:', err);
    }
  }

  res.json(room);
});

// 4. Player Connection Heartbeat
app.post('/api/rooms/:id/heartbeat', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const { playerId } = req.body;
  const room = await getRoom(code);

  if (!room) {
    return respondWithError(res, 404, 'Room tidak ditemukan');
  }

  let hasChanged = false;
  if (room.whitePlayer && room.whitePlayer.id === playerId) {
    room.whitePlayer.isOnline = true;
    hasChanged = true;
  } else if (room.blackPlayer && room.blackPlayer.id === playerId) {
    room.blackPlayer.isOnline = true;
    hasChanged = true;
  }

  if (hasChanged) {
    try {
      await saveRoom(code, room, OperationType.UPDATE);
    } catch (err) {
      // ignore transient heartbeat saves
    }
  }

  res.json({ success: true });
});

// 5. Submit Chess Move
app.post('/api/rooms/:id/move', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const { playerId, from, to, promotion } = req.body;

  const room = await getRoom(code);
  if (!room) {
    return respondWithError(res, 404, 'Room tidak ditemukan');
  }

  if (room.status !== 'playing') {
    return respondWithError(res, 400, 'Permainan belum dimulai atau sudah berakhir');
  }

  // Validate player turn
  const isWhiteTurn = room.turn === 'w';
  const validPlayer = isWhiteTurn ? room.whitePlayer : room.blackPlayer;
  
  if (!validPlayer || validPlayer.id !== playerId) {
    return respondWithError(res, 403, 'Bukan giliran Anda untuk melangkah!');
  }

  try {
    const game = new Chess(room.fen);
    
    // Execute move on engine
    const moveResult = game.move({ from, to, promotion: promotion || 'q' });
    
    // Success! Update board
    room.fen = game.fen();
    room.turn = game.turn();
    room.lastMovedAt = Date.now();

    // Deduct elapsed time before resetting tick
    if (room.timer.lastTickTimestamp) {
      const elapMs = Date.now() - room.timer.lastTickTimestamp;
      const elapSec = Math.floor(elapMs / 1000);
      if (room.turn === 'w') { // just switched FROM white (so white lost the time)
        room.timer.blackTimeSec = Math.max(0, room.timer.blackTimeSec - elapSec);
      } else {
        room.timer.whiteTimeSec = Math.max(0, room.timer.whiteTimeSec - elapSec);
      }
    }
    room.timer.lastTickTimestamp = Date.now();

    // Record Move
    const record: ChessMoveRecord = {
      san: moveResult.san,
      from,
      to,
      piece: moveResult.piece,
      color: moveResult.color,
      timestamp: Date.now(),
    };
    room.moves.push(record);

    // Evaluate game status (checkmate, stalemate, draw)
    if (game.isCheckmate()) {
      room.status = 'checkmate';
      room.winner = moveResult.color; // The color that made the checkmate is the winner
      room.timer.isRunning = false;
      room.chat.push({
        id: 'gameover_' + Date.now(),
        senderId: 'system',
        senderName: 'Sistem',
        text: `CHECKMATE! ${isWhiteTurn ? 'Putih' : 'Hitam'} menang dengan urutan gerak ${moveResult.san}!`,
        timestamp: Date.now(),
      });
    } else if (game.isDraw()) {
      room.status = 'draw';
      room.timer.isRunning = false;
      let drawReason = 'Seri (Draw)';
      if (game.isStalemate()) {
        room.status = 'stalemate';
        drawReason = 'Remis (Stalemate)';
      } else if (game.isThreefoldRepetition()) {
        drawReason = 'Seri karena Repetisi 3-kali';
      } else if (game.isInsufficientMaterial()) {
        drawReason = 'Seri karena Kekurangan Perwira';
      }
      room.chat.push({
        id: 'gameover_' + Date.now(),
        senderId: 'system',
        senderName: 'Sistem',
        text: `Game Selesai: ${drawReason}.`,
        timestamp: Date.now(),
      });
    } else if (game.inCheck()) {
      room.chat.push({
        id: 'check_' + Date.now(),
        senderId: 'system',
        senderName: 'Sistem',
        text: `SKAK! Raja ${room.turn === 'w' ? 'Putih' : 'Hitam'} diancam!`,
        timestamp: Date.now(),
      });
    }

    await saveRoom(code, room, OperationType.UPDATE);
    res.json(room);
  } catch (err) {
    console.error('Invalid move attempted:', err);
    return respondWithError(res, 400, 'Langkah catur tidak valid!');
  }
});

// 6. Submit In-room Chat Message
app.post('/api/rooms/:id/chat', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const { playerId, playerName, text } = req.body;

  if (!text || !playerId || !playerName) {
    return respondWithError(res, 400, 'Pesan, ID, dan nama wajib diisi');
  }

  const room = await getRoom(code);
  if (!room) {
    return respondWithError(res, 404, 'Room tidak ditemukan');
  }

  const newMessage: ChatMessage = {
    id: 'msg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    senderId: playerId,
    senderName: playerName,
    text,
    timestamp: Date.now(),
  };

  room.chat.push(newMessage);
  
  try {
    await saveRoom(code, room, OperationType.UPDATE);
    res.json(room);
  } catch (err) {
    respondWithError(res, 500, 'Gagal mengirim pesan chat ke database');
  }
});

// 7. Resign Match
app.post('/api/rooms/:id/resign', async (req, res) => {
  const code = req.params.id.toUpperCase();
  const { playerId } = req.body;

  const room = await getRoom(code);
  if (!room) {
    return respondWithError(res, 404, 'Room tidak ditemukan');
  }

  if (room.status !== 'playing') {
    return respondWithError(res, 400, 'Game tidak sedang dalam permainan');
  }

  const isWhite = room.whitePlayer && room.whitePlayer.id === playerId;
  const isBlack = room.blackPlayer && room.blackPlayer.id === playerId;

  if (!isWhite && !isBlack) {
    return respondWithError(res, 403, 'Akses tidak sah');
  }

  room.status = 'resigned';
  room.winner = isWhite ? 'b' : 'w';
  room.timer.isRunning = false;

  const resignee = isWhite ? room.whitePlayer?.name : room.blackPlayer?.name;
  const winnerName = isWhite ? room.blackPlayer?.name : room.whitePlayer?.name;

  room.chat.push({
    id: 'resign_' + Date.now(),
    senderId: 'system',
    senderName: 'Sistem',
    text: `${resignee} mengundurkan diri. ${winnerName} menjadi pemenang! 👋`,
    timestamp: Date.now(),
  });

  try {
    await saveRoom(code, room, OperationType.UPDATE);
    res.json(room);
  } catch (err) {
    respondWithError(res, 500, 'Gagal memperbarui status pengunduran diri di database');
  }
});


// --- GEMINI COOPERATIVE ROUTE (COACH & BOT BANTER) ---

// 1. AI Grandmaster Coach Analysis Endpoint
app.post('/api/gemini/coach', async (req, res) => {
  const { fen, moveHistory, turn, mode } = req.body;

  if (!fen) {
    return respondWithError(res, 400, 'State FEN tidak valid');
  }

  // Construct board context descriptions for the model
  const chessObj = new Chess(fen);
  const legalMoves = chessObj.moves({ verbose: true });
  
  let boardLayout = `Informasi Papan Saat Ini:\n`;
  boardLayout += `Turn: ${turn === 'w' ? 'Putih (White)' : 'Hitam (Black)'}\n`;
  boardLayout += `Apakah sedang kena Skak? ${chessObj.inCheck() ? 'YA' : 'TIDAK'}\n\n`;
  
  // Construct board string
  const finalRows: string[] = [];
  const b = chessObj.board();
  for (let r = 0; r < 8; r++) {
    let rowLine = `${8 - r} `;
    for (let c = 0; c < 8; c++) {
      const sq = b[r][c];
      if (sq) {
        rowLine += `[${sq.color === 'w' ? 'W' : 'B'}${sq.type.toUpperCase()}]`;
      } else {
        rowLine += `[  ]`;
      }
    }
    finalRows.push(rowLine);
  }
  boardLayout += finalRows.join('\n') + '\n  a   b   c   d   e   f   g   h\n';

  const movesText = moveHistory && moveHistory.length > 0 
    ? `Daftar langkah sebelumnya: ${moveHistory.map((m: any, idx: number) => `${idx + 1}. ${m.color === 'w' ? 'Putih' : 'Hitam'}: ${m.san}`).join(', ')}`
    : 'Belum ada langkah yang dibuat.';

  if (!ai) {
    // Procedural friendly fallback if API Key missing
    return res.json({
      analysis: "Halo! Saya adalah Asisten Pelatihan Catur Anda. Keadaan papan cukup menarik. Untuk mendapatkan analisis Grandmaster AI real-time, silakan konfigurasikan kunci API GEMINI_API_KEY Anda di Settings > Secrets.",
      tacticalTip: "Evaluasi taktis mendalam dinonaktifkan sementara karena kunci API belum diaktifkan.",
      suggestedMove: legalMoves.length > 0 ? {
        from: legalMoves[0].from,
        to: legalMoves[0].to,
        san: legalMoves[0].san,
        reason: "Langkah legal pertama yang terdeteksi secara otomatis."
      } : null
    });
  }

  try {
    const prompt = `Anda adalah Grandmaster Catur Profesional sekaligus Pelatih Catur (Chess Coach) yang sangat ramah, suportif, berwawasan luas, humoris, dan berbicara dalam Bahasa Indonesia.
Tugas Anda adalah meninjau susunan papan catur di bawah ini dan memberikan saran taktis yang mendalam bagi pemain yang memiliki giliran saat ini (${turn === 'w' ? 'Putih' : 'Hitam'}).

Data Masukan Catur:
${boardLayout}
Histori Langkah: ${movesText}

Langkah-langkah Legal yang Tersedia saat ini (Gunakan salah satu di antaranya untuk disarankan jika memang bagus):
${legalMoves.map(m => `${m.from} ke ${m.to} (${m.san})`).join(', ')}

Berikan evaluasi Anda dalam format JSON terstruktur yang ketat dengan properti berikut (jangan sertakan markdown, kode pembungkus selain objek JSON murni):
{
  "analysis": "Penjelasan berwawasan luas tentang visual ancaman, penguasaan papan, formasi pion, rintangan rute, atau pola taktis saat ini.",
  "tacticalTip": "Satu tips taktis praktis singkat, contoh: 'Pertahankan petak pusat d4' atau 'Waspadai garpu kuda musuh di f2'.",
  "suggestedMove": {
    "from": "asal petak, contoh: e2",
    "to": "target petak, contoh: e4",
    "san": "singkatan algebraic standar (SAN), contoh: e4",
    "reason": "Alasan strategis mengapa langkah ini disarankan."
  }
}

Jika tidak ada langkah legal, set suggestedMove menjadi null. Pastikan JSON valid dan properti penulisan sama persis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            tacticalTip: { type: Type.STRING },
            suggestedMove: {
              type: Type.OBJECT,
              properties: {
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                san: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ['from', 'to', 'san', 'reason']
            }
          },
          required: ['analysis', 'tacticalTip']
        }
      }
    });

    const textResult = response.text || '{}';
    const jsonParsed = JSON.parse(textResult.trim());
    res.json(jsonParsed);

  } catch (error) {
    console.error('Gemini AI Error in Coach endpoint:', error);
    res.json({
      analysis: "Maaf Coach AI sedang kewalahan membaca dinamika taktis di papan! Tetap fokus pada pusat papan, amankan Raja Anda (rokade), aktifkan perwira Anda, dan buat rencana yang kokoh.",
      tacticalTip: "Amankan Raja dengan rokade sedini mungkin jika rute masih aman.",
      suggestedMove: legalMoves.length > 0 ? {
        from: legalMoves[0].from,
        to: legalMoves[0].to,
        san: legalMoves[0].san,
        reason: "Langkah legal pertama sebagai alternatif aman."
      } : null
    });
  }
});

// 2. AI Chat Bot Banter / AI Mind Move Selector
app.post('/api/gemini/bot-move', async (req, res) => {
  const { fen, moves, botColor, botDifficulty } = req.body;

  if (!fen) {
    return respondWithError(res, 400, 'State FEN tidak valid');
  }

  // Set default fallback move
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });
  if (legalMoves.length === 0) {
    return res.json({ comment: "Skakmat! Kamu memenangkannya dengan hebat! Salut.", bestMove: null });
  }

  // Get procedural chosen move
  let selected = legalMoves[0];
  const rIdx = Math.floor(Math.random() * legalMoves.length);
  selected = legalMoves[rIdx]; // raw fallback

  const movesSummary = moves && moves.length > 0
    ? `Dua langkah terakhir: ${moves.slice(-2).map((m: any) => `${m.color === 'w' ? 'Putih' : 'Hitam'} melangkah ${m.san}`).join(', ')}`
    : 'Permainan baru saja dimulai!';

  if (!ai) {
    return res.json({
      comment: "Langkah yang menarik! Aku merasakannya. (Silakan konfigurasikan GEMINI_API_KEY untuk mengaktifkan taktik & dialog bot AI saya!).",
      bestMove: { from: selected.from, to: selected.to, san: selected.san }
    });
  }

  try {
    const prompt = `Anda adalah lawan bermain catur AI yang asyik, cerdik, berkarakter, dan sedikit suka melontarkan gurauan taktis dalam Bahasa Indonesia hangat (Friendly Chess Rival Bot).
Warna bidak Anda adalah: ${botColor === 'w' ? 'Putih' : 'Hitam'}.
Dinamika Papan Catur FEN: "${fen}"
Latar belakang aktivitas: ${movesSummary}

Daftar Pilihan Langkah Legal yang Bisa Anda Ambil:
${legalMoves.map(m => `asal: ${m.from}, target: ${m.to}, san: ${m.san}`).join('\n')}

Silakan pilih satu langkah legal yang taktis, logis, atau menarik dari daftar di atas. Lalu buat komentar sarkas lucu atau celetukan mental khas master catur Indonesia menanggapi situasi ini.

Format JSON keluaran yang ketat (tanpa markdown pembungkus):
{
  "comment": "Komentar atau obrolan santai Anda menanggapi langkah pemain atau jalannya pertandingan saat ini.",
  "bestMove": {
    "from": "e7 (pilihan petak asal langkah)",
    "to": "e5 (pilihan petak target tujuan)",
    "san": "e5 (algebraic SAN yang Anda pilih dari daftar)"
  }
}

Pilihlah salah satu dari PETAK YANG BENAR-BENAR ADA pada daftar langkah legal di atas!`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comment: { type: Type.STRING },
            bestMove: {
              type: Type.OBJECT,
              properties: {
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                san: { type: Type.STRING }
              },
              required: ['from', 'to', 'san']
            }
          },
          required: ['comment', 'bestMove']
        }
      }
    });

    const parsedResult = JSON.parse(response.text?.trim() || '{}');
    
    // Safety check - make sure selected move is actually in legalMoves list
    const candidate = parsedResult.bestMove;
    const isLegal = legalMoves.some(m => m.from === candidate?.from && m.to === candidate?.to);
    
    if (isLegal) {
      res.json(parsedResult);
    } else {
      // Procedural move fallback but keeping custom AI jokes
      const bestMove = calculateBestMoveProcedural(game, botDifficulty, botColor);
      res.json({
        comment: parsedResult.comment || "Melangkah dengan perlahan namun pasti!",
        bestMove
      });
    }

  } catch (error) {
    console.error('Gemini bot-move error, falling back:', error);
    // Silent procedural fallback when Gemini API limit / parse error occurs
    const bestMove = calculateBestMoveProcedural(game, botDifficulty, botColor);
    res.json({
      comment: "Langkah yang menantang! Biarkan papan yang bicara.",
      bestMove
    });
  }
});

// Private procedural move picker to guarantee legal Moves inside fallbacks
function calculateBestMoveProcedural(game: Chess, difficulty: string, col: string) {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  
  if (difficulty === 'easy') {
    const idx = Math.floor(Math.random() * moves.length);
    const chosen = moves[idx];
    return { from: chosen.from, to: chosen.to, san: chosen.san };
  }
  
  // Medium or hard procedural search
  const isMaximizing = col === 'w';
  const depth = difficulty === 'hard' ? 2 : 1;
  const [_, chosenMove] = minimaxFallback(game, depth, -Infinity, Infinity, isMaximizing);
  
  if (chosenMove) {
    return { from: chosenMove.from, to: chosenMove.to, san: chosenMove.san };
  }
  return { from: moves[0].from, to: moves[0].to, san: moves[0].san };
}

// Inline procedural minimax
function minimaxFallback(game: Chess, depth: number, alpha: number, beta: number, isMax: boolean): [number, any|null] {
  if (depth === 0 || game.isGameOver()) {
    // simple element counting
    let factor = 0;
    game.board().forEach(row => row.forEach(sq => {
      if (sq) {
        const val = sq.type === 'q' ? 90 : sq.type === 'r' ? 50 : sq.type === 'b' ? 33 : sq.type === 'n' ? 32 : sq.type === 'p' ? 10 : 1000;
        factor += sq.color === 'w' ? val : -val;
      }
    }));
    return [factor, null];
  }
  const moves = game.moves({ verbose: true });
  let chosen: any = null;
  if (isMax) {
    let max = -Infinity;
    for (const m of moves) {
      game.move(m);
      const [v] = minimaxFallback(game, depth - 1, alpha, beta, false);
      game.undo();
      if (v > max) { max = v; chosen = m; }
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return [max, chosen];
  } else {
    let min = Infinity;
    for (const m of moves) {
      game.move(m);
      const [v] = minimaxFallback(game, depth - 1, alpha, beta, true);
      game.undo();
      if (v < min) { min = v; chosen = m; }
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return [min, chosen];
  }
}

// Setup static file serving or Vite asset pipelines
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express Chess Server successfully listening on http://localhost:${PORT}`);
  });
};

startServer();
