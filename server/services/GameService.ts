import {
  Game,
  Player,
  GameRound,
  JoinGameResult,
  CreateGameResult,
} from "../types/Game";
import { RedisService } from "./RedisService";
import { OpenAIService } from "./OpenAIService";

export class GameService {
  private redisService: RedisService;
  private openaiService: OpenAIService;

  constructor(redisService: RedisService, openaiService: OpenAIService) {
    this.redisService = redisService;
    this.openaiService = openaiService;
  }

  getRedisService(): RedisService {
    return this.redisService;
  }

  async createGame(
    gameCode: string,
    hostId: string,
    hostNickname: string
  ): Promise<Game> {
    if (await this.redisService.gameExists(gameCode)) {
      throw new Error("Game code already exists");
    }

    const host: Player = {
      id: hostId,
      nickname: hostNickname,
      score: 0,
      isHost: true,
      isOnline: true,
      joinedAt: new Date(),
    };

    const game: Game = {
      code: gameCode,
      players: new Map([[hostId, host]]),
      rounds: [],
      currentRound: 0,
      status: "lobby",
      maxPlayers: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxRounds: 10, // Default to 10 rounds or number of players
        guessingTimeLimit: 15, // 15 seconds
      },
    };

    await this.redisService.saveGame(game);
    console.log(`🎮 Game ${gameCode} created by ${hostNickname}`);

    return game;
  }

  async joinGame(
    gameCode: string,
    playerId: string,
    nickname: string
  ): Promise<JoinGameResult> {
    const game = await this.redisService.getGame(gameCode);

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "lobby") {
      return { success: false, error: "Game has already started" };
    }

    if (game.players.size >= game.maxPlayers) {
      return { success: false, error: "Game is full" };
    }

    for (const [_, player] of game.players) {
      if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
        return { success: false, error: "Nickname already taken" };
      }
    }

    if (game.players.has(playerId)) {
      const player = game.players.get(playerId)!;
      player.isOnline = true;
      game.updatedAt = new Date();
      await this.redisService.saveGame(game);

      return { success: true, game };
    }

    // Add new player
    const newPlayer: Player = {
      id: playerId,
      nickname,
      score: 0,
      isHost: false,
      isOnline: true,
      joinedAt: new Date(),
    };

    game.players.set(playerId, newPlayer);
    game.updatedAt = new Date();

    await this.redisService.saveGame(game);

    // Publish player joined event
    await this.redisService.publishToGame(gameCode, "playerJoined", {
      player: this.serializePlayer(newPlayer),
      totalPlayers: game.players.size,
    });

    console.log(`👤 ${nickname} joined game ${gameCode}`);

    return { success: true, game };
  }

  async leaveGame(gameCode: string, playerId: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || !game.players.has(playerId)) {
      return;
    }

    const player = game.players.get(playerId)!;

    if (game.status === "lobby") {
      game.players.delete(playerId);

      if (player.isHost && game.players.size > 0) {
        const newHost = Array.from(game.players.values())[0];
        newHost.isHost = true;
      }
    } else {
      player.isOnline = false;
    }

    game.updatedAt = new Date();

    if (game.players.size === 0) {
      await this.redisService.deleteGame(gameCode);
      console.log(`🗑️  Game ${gameCode} deleted (empty)`);
    } else {
      await this.redisService.saveGame(game);

      await this.redisService.publishToGame(gameCode, "playerLeft", {
        playerId,
        nickname: player.nickname,
        totalPlayers: game.players.size,
      });
    }

    console.log(`👋 ${player.nickname} left game ${gameCode}`);
  }

  async startGame(gameCode: string, hostId: string): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game) {
      return false;
    }

    const host = game.players.get(hostId);
    if (!host || !host.isHost) {
      return false;
    }

    if (game.status !== "lobby") {
      return false;
    }

    if (game.players.size < 2) {
      return false;
    }

    game.settings.maxRounds = Math.min(
      game.settings.maxRounds,
      game.players.size
    );

    game.status = "playing";
    game.updatedAt = new Date();

    const firstRound = this.createNewRound(1, game.players);
    game.rounds.push(firstRound);
    game.currentRound = 1;

    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "gameStarted", {
      round: 1,
      prompterId: firstRound.prompterId,
      totalRounds: game.settings.maxRounds,
    });

    console.log(
      `🚀 Game ${gameCode} started with ${game.players.size} players`
    );

    return true;
  }

  async getGame(gameCode: string): Promise<Game | null> {
    return await this.redisService.getGame(gameCode);
  }

  async updatePlayerOnlineStatus(
    gameCode: string,
    playerId: string,
    isOnline: boolean
  ): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || !game.players.has(playerId)) {
      return;
    }

    const player = game.players.get(playerId)!;
    player.isOnline = isOnline;
    game.updatedAt = new Date();

    await this.redisService.saveGame(game);
  }

  private createNewRound(
    roundNumber: number,
    players: Map<string, Player>
  ): GameRound {
    const playerIds = Array.from(players.keys());
    const prompterIndex = (roundNumber - 1) % playerIds.length;
    const prompterId = playerIds[prompterIndex];

    return {
      roundNumber,
      prompterId,
      guesses: new Map(),
      scores: new Map(),
      status: "waiting_for_prompt",
    };
  }

  private serializePlayer(player: Player): any {
    return {
      id: player.id,
      nickname: player.nickname,
      score: player.score,
      isHost: player.isHost,
      isOnline: player.isOnline,
      joinedAt: player.joinedAt.toISOString(),
    };
  }

  async submitPrompt(
    gameCode: string,
    playerId: string,
    prompt: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1];
    if (!currentRound || currentRound.status !== "waiting_for_prompt") {
      return false;
    }

    if (currentRound.prompterId !== playerId) {
      return false;
    }

    if (!prompt || prompt.trim().length === 0 || prompt.trim().length > 500) {
      return false;
    }

    currentRound.prompt = prompt.trim();
    currentRound.status = "generating_image";
    currentRound.startedAt = new Date();

    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "imageGenerating", {
      round: game.currentRound,
      prompter: game.players.get(playerId)?.nickname,
    });

    this.generateImageForRound(gameCode, prompt);

    console.log(`📝 Prompt submitted for game ${gameCode}: "${prompt}"`);

    return true;
  }

  async submitGuess(
    gameCode: string,
    playerId: string,
    guess: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1];
    if (!currentRound || currentRound.status !== "guessing") {
      return false;
    }

    if (currentRound.prompterId === playerId) {
      return false;
    }

    if (!guess || guess.trim().length === 0 || guess.trim().length > 200) {
      return false;
    }

    currentRound.guesses.set(playerId, guess.trim());

    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "guessReceived", {
      playerId,
      guessCount: currentRound.guesses.size,
      totalPlayers: game.players.size - 1,
    });

    console.log(`🤔 Guess submitted by ${playerId} in game ${gameCode}`);

    const expectedGuesses = game.players.size - 1;
    if (currentRound.guesses.size >= expectedGuesses) {
      await this.endGuessingPhase(gameCode);
    }

    return true;
  }

  private async generateImageForRound(
    gameCode: string,
    prompt: string
  ): Promise<void> {
    try {
      const result = await this.openaiService.generateImage(prompt);

      const game = await this.redisService.getGame(gameCode);
      if (!game) {
        return;
      }

      const currentRound = game.rounds[game.currentRound - 1];
      if (!currentRound) {
        return;
      }

      if (result.success && result.imageUrl) {
        currentRound.imageUrl = result.imageUrl;
        currentRound.status = "guessing";

        await this.redisService.saveGame(game);

        await this.redisService.publishToGame(gameCode, "imageReady", {
          round: game.currentRound,
          imageUrl: result.imageUrl,
          guessingTimeLimit: game.settings.guessingTimeLimit,
        });

        this.startGuessingTimer(gameCode, game.settings.guessingTimeLimit);

        console.log(`🎨 Image generated for game ${gameCode}`);
      } else {
        console.error(
          `Failed to generate image for game ${gameCode}:`,
          result.error
        );

        await this.redisService.publishToGame(
          gameCode,
          "imageGenerationFailed",
          {
            error: result.error || "Image generation failed",
            round: game.currentRound,
          }
        );
      }
    } catch (error) {
      console.error("Error in image generation:", error);

      await this.redisService.publishToGame(gameCode, "imageGenerationFailed", {
        error: "An unexpected error occurred",
      });
    }
  }

  private startGuessingTimer(gameCode: string, timeLimit: number): void {
    setTimeout(async () => {
      await this.endGuessingPhase(gameCode);
    }, timeLimit * 1000);
  }

  private async endGuessingPhase(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.status !== "playing") {
      return;
    }

    const currentRound = game.rounds[game.currentRound - 1];
    if (!currentRound || currentRound.status !== "guessing") {
      return;
    }

    currentRound.status = "revealing";
    currentRound.endedAt = new Date();

    if (currentRound.prompt) {
      const scores = await this.openaiService.calculateSimilarityScores(
        currentRound.prompt,
        currentRound.guesses
      );

      for (const score of scores) {
        currentRound.scores.set(score.playerId, score.points);

        const player = game.players.get(score.playerId);
        if (player) {
          player.score += score.points;
        }
      }
    }

    await this.redisService.saveGame(game);

    const results = {
      round: game.currentRound,
      prompt: currentRound.prompt,
      imageUrl: currentRound.imageUrl,
      guesses: Array.from(currentRound.guesses.entries()).map(
        ([playerId, guess]) => ({
          playerId,
          nickname: game.players.get(playerId)?.nickname,
          guess,
          points: currentRound.scores.get(playerId) || 0,
        })
      ),
      scores: Array.from(game.players.values())
        .map((player) => ({
          playerId: player.id,
          nickname: player.nickname,
          totalScore: player.score,
        }))
        .sort((a, b) => b.totalScore - a.totalScore),
    };

    await this.redisService.publishToGame(gameCode, "roundResults", results);

    console.log(`📊 Round ${game.currentRound} completed for game ${gameCode}`);

    setTimeout(async () => {
      await this.startNextRound(gameCode);
    }, 5000); // 5 second delay
  }

  private async startNextRound(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.status !== "playing") {
      return;
    }

    if (game.currentRound >= game.settings.maxRounds) {
      await this.endGame(gameCode);
      return;
    }

    game.currentRound += 1;
    const nextRound = this.createNewRound(game.currentRound, game.players);
    game.rounds.push(nextRound);

    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "nextRound", {
      round: game.currentRound,
      prompterId: nextRound.prompterId,
      prompterNickname: game.players.get(nextRound.prompterId)?.nickname,
      totalRounds: game.settings.maxRounds,
    });

    console.log(`🔄 Started round ${game.currentRound} for game ${gameCode}`);
  }

  private async endGame(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game) {
      return;
    }

    game.status = "completed";
    await this.redisService.saveGame(game);

    const finalResults = {
      winner: Array.from(game.players.values()).reduce((prev, current) =>
        current.score > prev.score ? current : prev
      ),
      finalScores: Array.from(game.players.values())
        .map((player) => ({
          playerId: player.id,
          nickname: player.nickname,
          totalScore: player.score,
        }))
        .sort((a, b) => b.totalScore - a.totalScore),
    };

    await this.redisService.publishToGame(gameCode, "gameEnd", finalResults);

    console.log(
      `🏆 Game ${gameCode} completed! Winner: ${finalResults.winner.nickname}`
    );

    setTimeout(async () => {
      await this.redisService.deleteGame(gameCode);
      console.log(`🗑️ Game ${gameCode} data deleted`);
    }, 300000); // 5 minutes delay
  }
}
