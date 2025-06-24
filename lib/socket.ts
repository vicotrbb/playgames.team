"use client";

import { io, Socket } from "socket.io-client";
import { useState, useEffect } from "react";

const SOCKET_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
}

export interface GameState {
  code: string;
  players: Player[];
  status: "lobby" | "playing" | "completed";
  currentRound: number;
  maxPlayers: number;
  settings: {
    maxRounds: number;
    guessingTimeLimit: number;
  };
}

export interface GameplayData {
  currentRound: number;
  prompterId: string;
  prompterNickname: string;
  gamePhase:
    | "waiting_for_prompt"
    | "generating_image"
    | "guessing"
    | "revealing"
    | "completed";
  imageUrl?: string;
  timeRemaining?: number;
  guessCount?: number;
  totalGuessers?: number;
}

export interface RoundResults {
  round: number;
  prompt: string;
  imageUrl: string;
  guesses: Array<{
    playerId: string;
    nickname: string;
    guess: string;
    points: number;
  }>;
  scores: Array<{
    playerId: string;
    nickname: string;
    totalScore: number;
  }>;
}

export interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  gameState: GameState | null;
  playerId: string | null;
  error: string | null;
  gameplayData: GameplayData | null;
  roundResults: RoundResults | null;
  createGame: (nickname: string) => Promise<boolean>;
  joinGame: (gameCode: string, nickname: string) => Promise<boolean>;
  startGame: () => void;
  leaveGame: () => void;
  sendChatMessage: (message: string) => void;
  submitPrompt: (prompt: string) => void;
  submitGuess: (guess: string) => void;
}

let globalSocket: Socket | null = null;

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameplayData, setGameplayData] = useState<GameplayData | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);

  useEffect(() => {
    if (globalSocket) {
      console.log("🔄 Reusing existing socket instance");
      setSocket(globalSocket);
      setConnected(globalSocket.connected);
      return;
    }

    const socketId = Math.random().toString(36).substr(2, 9);
    console.log("🆔 Creating NEW socket instance:", socketId);

    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });

    globalSocket = socketInstance;

    socketInstance.on("connect", () => {
      console.log("🔌 Connected to server");
      setConnected(true);
      setError(null);
    });

    socketInstance.on("disconnect", () => {
      console.log("🔌 Disconnected from server");
      setConnected(false);
    });

    socketInstance.on("error", (errorData: { message: string }) => {
      console.error("Socket error:", errorData.message);
      setError(errorData.message);
    });

    socketInstance.on(
      "gameState",
      (data: { game: GameState; playerId: string }) => {
        console.log(`📊 [${socketId}] Game state received:`, data);
        console.log(
          `📊 [${socketId}] Setting gameState with players:`,
          data.game.players
        );
        console.log(`📊 [${socketId}] About to set gameState:`, data.game);
        console.log(`📊 [${socketId}] About to set playerId:`, data.playerId);
        setGameState(data.game);
        setPlayerId(data.playerId);

        setTimeout(() => {
          console.log(
            `📊 [${socketId}] State check after setting - gameState exists:`,
            !!data.game
          );
        }, 100);
      }
    );

    socketInstance.on(
      "playerJoined",
      (data: { player: Player; totalPlayers: number }) => {
        console.log("👤 Player joined:", data.player.nickname);
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: [...prev.players, data.player],
          };
        });
      }
    );

    socketInstance.on(
      "playerLeft",
      (data: { playerId: string; nickname: string; totalPlayers: number }) => {
        console.log("👋 Player left:", data.nickname);
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.filter((p) => p.id !== data.playerId),
          };
        });
      }
    );

    socketInstance.on(
      "playerOnline",
      (data: { playerId: string; nickname: string }) => {
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === data.playerId ? { ...p, isOnline: true } : p
            ),
          };
        });
      }
    );

    socketInstance.on(
      "playerOffline",
      (data: { playerId: string; nickname: string }) => {
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === data.playerId ? { ...p, isOnline: false } : p
            ),
          };
        });
      }
    );

    socketInstance.on(
      "gameStarted",
      (data: { round: number; prompterId: string; totalRounds: number }) => {
        console.log("🚀 Game started!");
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: "playing",
            currentRound: data.round,
          };
        });
      }
    );

    socketInstance.on("leftGame", () => {
      setGameState(null);
      setPlayerId(null);
      setGameplayData(null);
      setRoundResults(null);
    });

    // Gameplay events
    socketInstance.on(
      "imageGenerating",
      (data: { round: number; prompter: string }) => {
        console.log("🎨 Image generation started");
        setGameplayData((prev) => ({
          ...prev!,
          currentRound: data.round,
          gamePhase: "generating_image",
          prompterNickname: data.prompter,
        }));
      }
    );

    socketInstance.on(
      "imageReady",
      (data: {
        round: number;
        imageUrl: string;
        guessingTimeLimit: number;
      }) => {
        console.log("🖼️ Image ready for guessing");
        setGameplayData((prev) => ({
          ...prev!,
          currentRound: data.round,
          gamePhase: "guessing",
          imageUrl: data.imageUrl,
          timeRemaining: data.guessingTimeLimit,
          guessCount: 0,
        }));
      }
    );

    socketInstance.on(
      "guessReceived",
      (data: {
        playerId: string;
        guessCount: number;
        totalPlayers: number;
      }) => {
        setGameplayData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            guessCount: data.guessCount,
            totalGuessers: data.totalPlayers,
          };
        });
      }
    );

    socketInstance.on("roundResults", (data: RoundResults) => {
      console.log("📊 Round results received");
      setGameplayData((prev) => ({
        ...prev!,
        gamePhase: "revealing",
      }));
      setRoundResults(data);

      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((player) => {
            const scoreData = data.scores.find((s) => s.playerId === player.id);
            return scoreData
              ? { ...player, score: scoreData.totalScore }
              : player;
          }),
        };
      });
    });

    socketInstance.on(
      "nextRound",
      (data: {
        round: number;
        prompterId: string;
        prompterNickname: string;
        totalRounds: number;
      }) => {
        console.log(`🔄 Starting round ${data.round}`);
        setGameplayData({
          currentRound: data.round,
          prompterId: data.prompterId,
          prompterNickname: data.prompterNickname,
          gamePhase: "waiting_for_prompt",
          guessCount: 0,
          totalGuessers: 0,
        });
        setRoundResults(null);

        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            currentRound: data.round,
          };
        });
      }
    );

    socketInstance.on("gameEnd", () => {
      console.log("🏆 Game completed!");
      setGameplayData((prev) => ({
        ...prev!,
        gamePhase: "completed",
      }));

      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: "completed",
        };
      });
    });

    socketInstance.on(
      "imageGenerationFailed",
      (data: { error: string; round: number }) => {
        console.error("❌ Image generation failed:", data.error);
        setError(`Image generation failed: ${data.error}`);
      }
    );

    socketInstance.on("guessSubmitted", () => {
      console.log("✅ Guess submitted successfully");
    });

    setSocket(socketInstance);

    return () => {
      if (globalSocket === socketInstance) {
        console.log("🧹 Cleaning up socket instance");
        socketInstance.disconnect();
        globalSocket = null;
      }
    };
  }, []);

  const createGame = async (nickname: string): Promise<boolean> => {
    try {
      setError(null);
      console.log("🎮 Creating game for:", nickname);
      console.log("🌐 Socket URL:", SOCKET_URL);
      console.log(
        "🔌 Socket state - exists:",
        !!socket,
        "connected:",
        connected
      );

      const response = await fetch(`${SOCKET_URL}/api/create-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ hostNickname: nickname }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ HTTP error:", errorData);
        setError(errorData.error || "Failed to create game");
        return false;
      }

      const data = await response.json();
      console.log("✅ Game created:", data);
      setPlayerId(data.hostId);

      if (!socket) {
        console.error("❌ Socket instance not available!");
        setError("Socket not initialized");
        return false;
      }

      if (!connected) {
        console.log("🔌 Connecting socket...");
        socket.connect();
      }

      const joinGameRoom = () => {
        console.log(
          "🎯 Joining game room:",
          data.gameCode,
          "as player:",
          data.hostId
        );
        socket.emit("joinGame", {
          gameCode: data.gameCode,
          playerId: data.hostId,
        });
      };

      if (connected) {
        console.log("✅ Socket already connected, joining immediately");
        joinGameRoom();
      } else {
        console.log("⏳ Waiting for socket connection...");

        const connectionTimeout = setTimeout(() => {
          console.error("⏰ Socket connection timeout!");
          setError("Connection timeout - please try again");
        }, 5000);

        socket.once("connect", () => {
          clearTimeout(connectionTimeout);
          console.log("✅ Socket connected, now joining game room");
          joinGameRoom();
        });
      }

      return true;
    } catch (error) {
      console.error("❌ Error creating game:", error);
      setError("Failed to create game");
      return false;
    }
  };

  const joinGame = async (
    gameCode: string,
    nickname: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch(`${SOCKET_URL}/api/join-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ gameCode: gameCode.toUpperCase(), nickname }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to join game");
        return false;
      }

      const data = await response.json();
      setPlayerId(data.playerId);

      if (socket && !connected) {
        socket.connect();
      }

      if (socket) {
        const joinGameRoom = () => {
          socket.emit("joinGame", {
            gameCode: gameCode.toUpperCase(),
            playerId: data.playerId,
          });
        };

        if (connected) {
          joinGameRoom();
        } else {
          socket.once("connect", joinGameRoom);
        }
      }

      return true;
    } catch (error) {
      console.error("Error joining game:", error);
      setError("Failed to join game");
      return false;
    }
  };

  const startGame = () => {
    if (socket) {
      socket.emit("startGame");
    }
  };

  const leaveGame = () => {
    if (socket) {
      socket.emit("leaveGame");
    }
  };

  const sendChatMessage = (message: string) => {
    if (socket && message.trim()) {
      socket.emit("chatMessage", { message: message.trim() });
    }
  };

  const submitPrompt = (prompt: string) => {
    if (socket && prompt.trim()) {
      socket.emit("submitPrompt", { prompt: prompt.trim() });
    }
  };

  const submitGuess = (guess: string) => {
    if (socket && guess.trim()) {
      socket.emit("submitGuess", { guess: guess.trim() });
    }
  };

  console.log(
    "🔄 useSocket returning - gameState:",
    !!gameState,
    "playerId:",
    !!playerId
  );

  return {
    socket,
    connected,
    gameState,
    playerId,
    error,
    gameplayData,
    roundResults,
    createGame,
    joinGame,
    startGame,
    leaveGame,
    sendChatMessage,
    submitPrompt,
    submitGuess,
  };
}
