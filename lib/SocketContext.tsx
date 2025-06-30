"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
// Updated GameState interface to support all game types
export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
}

export interface GameState {
  code: string;
  gameType: "guessio" | "emojistory" | "twotruths";
  players: Player[];
  status: "lobby" | "playing" | "completed";
  currentRound: number;
  maxPlayers: number;
  settings: {
    maxRounds: number;
    guessingTimeLimit?: number;
    timePerTurn?: number;
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

const SOCKET_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  gameState: GameState | null;
  playerId: string | null;
  error: string | null;
  gameplayData: GameplayData | null;
  roundResults: RoundResults | null;
  createGame: (nickname: string, gameType?: "guessio" | "emojistory" | "twotruths") => Promise<boolean>;
  joinGame: (gameCode: string, nickname: string) => Promise<boolean>;
  startGame: () => void;
  leaveGame: () => void;
  sendChatMessage: (message: string) => void;
  submitPrompt: (prompt: string) => void;
  submitGuess: (guess: string) => void;
  submitEmojis: (emojis: string) => void;
  submitStoryInterpretation: (interpretation: string) => void;
  submitVote: (votedForPlayerId: string) => void;
  submitStatements: (statements: Array<{ text: string; isLie: boolean }>) => void;
  submitTwoTruthsVote: (statementId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameplayData, setGameplayData] = useState<GameplayData | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);

  useEffect(() => {
    console.log("🏗️ Initializing SocketProvider");

    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });

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
        console.log("📊 Game state received:", data);
        console.log("📊 Setting gameState with players:", data.game.players);
        setGameState(data.game);
        setPlayerId(data.playerId);
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

          // Set initial gameplay data using current game state
          const prompterPlayer = prev.players.find(
            (p) => p.id === data.prompterId
          );

          setGameplayData({
            currentRound: data.round,
            prompterId: data.prompterId,
            prompterNickname: prompterPlayer?.nickname || "Unknown",
            gamePhase: "waiting_for_prompt",
            guessCount: 0,
            totalGuessers: 0,
          });

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
        setGameplayData((prev) =>
          prev
            ? {
                ...prev,
                currentRound: data.round,
                gamePhase: "generating_image",
                prompterNickname: data.prompter,
              }
            : null
        );
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
        setGameplayData((prev) =>
          prev
            ? {
                ...prev,
                currentRound: data.round,
                gamePhase: "guessing",
                imageUrl: data.imageUrl,
                timeRemaining: data.guessingTimeLimit,
                guessCount: 0,
              }
            : null
        );
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
      setGameplayData((prev) =>
        prev
          ? {
              ...prev,
              gamePhase: "revealing",
            }
          : null
      );
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
      setGameplayData((prev) =>
        prev
          ? {
              ...prev,
              gamePhase: "completed",
            }
          : null
      );

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
      console.log("🧹 Cleaning up socket");
      socketInstance.disconnect();
    };
  }, []);

  const createGame = async (nickname: string, gameType: "guessio" | "emojistory" | "twotruths" = "guessio"): Promise<boolean> => {
    try {
      setError(null);
      console.log("🎮 Creating game for:", nickname, "type:", gameType);

      const response = await fetch(`${SOCKET_URL}/api/create-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ hostNickname: nickname, gameType }),
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
          gameCode: data.gameCode.toUpperCase(),
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

  const submitEmojis = (emojis: string) => {
    if (socket && emojis.trim()) {
      socket.emit("submitEmojis", { emojis: emojis.trim() });
    }
  };

  const submitStoryInterpretation = (interpretation: string) => {
    if (socket && interpretation.trim()) {
      socket.emit("submitStoryInterpretation", { interpretation: interpretation.trim() });
    }
  };

  const submitVote = (votedForPlayerId: string) => {
    if (socket && votedForPlayerId) {
      socket.emit("submitVote", { votedForPlayerId });
    }
  };

  const submitStatements = (statements: Array<{ text: string; isLie: boolean }>) => {
    if (socket && statements.length === 3) {
      socket.emit("submitStatements", { statements });
    }
  };

  const submitTwoTruthsVote = (statementId: string) => {
    if (socket && statementId) {
      socket.emit("submitTwoTruthsVote", { statementId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
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
        submitEmojis,
        submitStoryInterpretation,
        submitVote,
        submitStatements,
        submitTwoTruthsVote,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
