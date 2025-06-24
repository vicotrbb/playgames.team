import { Server, Socket } from "socket.io";
import { GameService } from "../services/GameService";

interface SocketData {
  gameCode?: string;
  playerId?: string;
  nickname?: string;
}

export class SocketHandler {
  private io: Server;
  private gameService: GameService;
  private socketGameMap: Map<string, string> = new Map(); // socketId -> gameCode
  private gameSocketsMap: Map<string, Set<string>> = new Map(); // gameCode -> Set<socketId>
  private subscribedGames: Set<string> = new Set(); // Track which games we're subscribed to

  constructor(io: Server, gameService: GameService) {
    this.io = io;
    this.gameService = gameService;
  }

  private async subscribeToGameEvents(gameCode: string) {
    if (this.subscribedGames.has(gameCode)) return;

    this.subscribedGames.add(gameCode);
    console.log(`📡 Subscribing to events for game ${gameCode}`);

    const redisService = this.gameService.getRedisService();
    await redisService.subscribeToGame(gameCode, (event: string, data: any) => {
      console.log(`📢 Broadcasting ${event} to game ${gameCode}:`, data);
      this.broadcastToGame(gameCode, event, data);
    });
  }

  handleConnection(socket: Socket) {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on(
      "joinGame",
      async (data: { gameCode: string; playerId: string }) => {
        try {
          const { gameCode, playerId } = data;
          console.log(
            `🎯 WebSocket joinGame request - gameCode: ${gameCode}, playerId: ${playerId}`
          );

          if (!gameCode || !playerId) {
            console.log("❌ Missing gameCode or playerId");
            socket.emit("error", {
              message: "Game code and player ID are required",
            });
            return;
          }

          const game = await this.gameService.getGame(gameCode.toUpperCase());
          console.log(
            `🎲 Retrieved game:`,
            game ? `${game.code} with ${game.players.size} players` : "null"
          );

          if (!game) {
            console.log("❌ Game not found");
            socket.emit("error", { message: "Game not found" });
            return;
          }

          const player = game.players.get(playerId);
          console.log(
            `👤 Retrieved player:`,
            player ? `${player.nickname} (${player.id})` : "null"
          );

          if (!player) {
            console.log("❌ Player not found in game");
            socket.emit("error", { message: "Player not found in game" });
            return;
          }

          await socket.join(gameCode);

          socket.data = {
            gameCode: gameCode.toUpperCase(),
            playerId,
            nickname: player.nickname,
          } as SocketData;

          this.socketGameMap.set(socket.id, gameCode.toUpperCase());
          if (!this.gameSocketsMap.has(gameCode.toUpperCase())) {
            this.gameSocketsMap.set(gameCode.toUpperCase(), new Set());
          }
          this.gameSocketsMap.get(gameCode.toUpperCase())!.add(socket.id);

          await this.gameService.updatePlayerOnlineStatus(
            gameCode.toUpperCase(),
            playerId,
            true
          );

          await this.subscribeToGameEvents(gameCode.toUpperCase());

          const serializedGame = this.serializeGameForClient(game);
          console.log(
            `📊 Sending gameState to ${player.nickname}:`,
            serializedGame
          );
          socket.emit("gameState", {
            game: serializedGame,
            playerId,
          });

          socket.to(gameCode).emit("playerOnline", {
            playerId,
            nickname: player.nickname,
          });

          console.log(`👤 ${player.nickname} joined game room ${gameCode}`);
        } catch (error) {
          console.error("Error handling joinGame:", error);
          socket.emit("error", { message: "Failed to join game" });
        }
      }
    );

    socket.on("startGame", async () => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData.gameCode || !socketData.playerId) {
          socket.emit("error", { message: "Not connected to a game" });
          return;
        }

        const success = await this.gameService.startGame(
          socketData.gameCode,
          socketData.playerId
        );

        if (!success) {
          socket.emit("error", {
            message:
              "Failed to start game. Make sure you are the host and have at least 2 players.",
          });
          return;
        }
      } catch (error) {
        console.error("Error starting game:", error);
        socket.emit("error", { message: "Failed to start game" });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      const socketData = socket.data as SocketData;
      if (socketData.gameCode && socketData.playerId) {
        await this.gameService.updatePlayerOnlineStatus(
          socketData.gameCode,
          socketData.playerId,
          false
        );

        socket.to(socketData.gameCode).emit("playerOffline", {
          playerId: socketData.playerId,
          nickname: socketData.nickname,
        });

        this.socketGameMap.delete(socket.id);
        const gameSockets = this.gameSocketsMap.get(socketData.gameCode);
        if (gameSockets) {
          gameSockets.delete(socket.id);
          if (gameSockets.size === 0) {
            this.gameSocketsMap.delete(socketData.gameCode);
          }
        }

        console.log(
          `👤 ${socketData.nickname} went offline from game ${socketData.gameCode}`
        );
      }
    });

    socket.on("leaveGame", async () => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData.gameCode || !socketData.playerId) {
          return;
        }

        await this.gameService.leaveGame(
          socketData.gameCode,
          socketData.playerId
        );

        await socket.leave(socketData.gameCode);

        socket.data = {};
        this.socketGameMap.delete(socket.id);

        const gameSockets = this.gameSocketsMap.get(socketData.gameCode);
        if (gameSockets) {
          gameSockets.delete(socket.id);
          if (gameSockets.size === 0) {
            this.gameSocketsMap.delete(socketData.gameCode);
          }
        }

        socket.emit("leftGame");
      } catch (error) {
        console.error("Error handling leaveGame:", error);
        socket.emit("error", { message: "Failed to leave game" });
      }
    });

    socket.on("chatMessage", async (data: { message: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData.gameCode || !socketData.playerId) {
          return;
        }

        this.io.to(socketData.gameCode).emit("chatMessage", {
          playerId: socketData.playerId,
          nickname: socketData.nickname,
          message: data.message,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error handling chat message:", error);
      }
    });

    socket.on("submitPrompt", async (data: { prompt: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData.gameCode || !socketData.playerId) {
          socket.emit("error", { message: "Not connected to a game" });
          return;
        }

        const success = await this.gameService.submitPrompt(
          socketData.gameCode,
          socketData.playerId,
          data.prompt
        );

        if (!success) {
          socket.emit("error", { message: "Failed to submit prompt" });
          return;
        }
      } catch (error) {
        console.error("Error submitting prompt:", error);
        socket.emit("error", { message: "Failed to submit prompt" });
      }
    });

    socket.on("submitGuess", async (data: { guess: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData.gameCode || !socketData.playerId) {
          socket.emit("error", { message: "Not connected to a game" });
          return;
        }

        const success = await this.gameService.submitGuess(
          socketData.gameCode,
          socketData.playerId,
          data.guess
        );

        if (!success) {
          socket.emit("error", { message: "Failed to submit guess" });
          return;
        }

        socket.emit("guessSubmitted", { success: true });
      } catch (error) {
        console.error("Error submitting guess:", error);
        socket.emit("error", { message: "Failed to submit guess" });
      }
    });
  }

  async broadcastToGame(gameCode: string, event: string, data: any) {
    this.io.to(gameCode).emit(event, data);
  }

  private serializeGameForClient(game: any) {
    return {
      code: game.code,
      players: Array.from(game.players.values()).map((player: any) => ({
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        isHost: player.isHost,
        isOnline: player.isOnline,
      })),
      status: game.status,
      currentRound: game.currentRound,
      maxPlayers: game.maxPlayers,
      settings: game.settings,
    };
  }

  getGameSockets(gameCode: string): Set<string> {
    return this.gameSocketsMap.get(gameCode) || new Set();
  }
}
