import {
  Game,
  GameType,
  Player,
  GameRound,
  GuessioRound,
  EmojiStoryRound,
  TwoTruthsRound,
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
    hostNickname: string,
    gameType: GameType = "guessio"
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
      gameType,
      players: new Map([[hostId, host]]),
      rounds: [],
      currentRound: 0,
      status: "lobby",
      maxPlayers: gameType === "emojistory" ? 20 : gameType === "twotruths" ? 10 : 50, // Different games have different optimal player counts
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxRounds: gameType === "emojistory" ? 3 : gameType === "twotruths" ? 10 : 10, // TwoTruths can have more rounds since they're shorter
        guessingTimeLimit: gameType === "guessio" ? 15 : undefined,
        timePerTurn: gameType === "emojistory" ? 30 : undefined,
        timeToSubmitStatements: gameType === "twotruths" ? 60 : undefined,
        timeToVote: gameType === "twotruths" ? 30 : undefined,
      },
    };

    await this.redisService.saveGame(game);
    console.log(`🎮 ${gameType} game ${gameCode} created by ${hostNickname}`);

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

    const firstRound = this.createNewRound(1, game.players, game.gameType);
    game.rounds.push(firstRound);
    game.currentRound = 1;

    await this.redisService.saveGame(game);

    if (game.gameType === "guessio") {
      const guessioRound = firstRound as GuessioRound;
      await this.redisService.publishToGame(gameCode, "gameStarted", {
        round: 1,
        prompterId: guessioRound.prompterId,
        totalRounds: game.settings.maxRounds,
      });
    } else if (game.gameType === "emojistory") {
      const emojiRound = firstRound as EmojiStoryRound;
      await this.redisService.publishToGame(gameCode, "gameStarted", {
        round: 1,
        currentTurnPlayerId: emojiRound.currentTurnPlayerId,
        currentTurnNickname: game.players.get(emojiRound.currentTurnPlayerId!)?.nickname,
        totalRounds: game.settings.maxRounds,
        timePerTurn: emojiRound.timePerTurn,
      });
    } else if (game.gameType === "twotruths") {
      const twoTruthsRound = firstRound as TwoTruthsRound;
      await this.redisService.publishToGame(gameCode, "gameStarted", {
        round: 1,
        currentPresenterPlayerId: twoTruthsRound.currentPresenterPlayerId,
        currentPresenterNickname: game.players.get(twoTruthsRound.currentPresenterPlayerId)?.nickname,
        totalRounds: game.settings.maxRounds,
        timeToSubmit: twoTruthsRound.timeToSubmit,
      });
    }

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
    players: Map<string, Player>,
    gameType: GameType
  ): GameRound {
    const playerIds = Array.from(players.keys());

    if (gameType === "guessio") {
      const prompterIndex = (roundNumber - 1) % playerIds.length;
      const prompterId = playerIds[prompterIndex];

      return {
        roundNumber,
        prompterId,
        guesses: new Map(),
        scores: new Map(),
        status: "waiting_for_prompt",
      } as GuessioRound;
    } else if (gameType === "emojistory") {
      return {
        roundNumber,
        storyContributions: [],
        storyInterpretations: new Map(),
        votes: new Map(),
        scores: new Map(),
        status: "story_building",
        currentTurnPlayerId: playerIds[0], // Start with first player
        timePerTurn: 30,
      } as EmojiStoryRound;
    } else { // twotruths
      const presenterIndex = (roundNumber - 1) % playerIds.length;
      const presenterId = playerIds[presenterIndex];

      return {
        roundNumber,
        currentPresenterPlayerId: presenterId,
        statements: [],
        votes: new Map(),
        scores: new Map(),
        status: "waiting_for_statements",
        timeToSubmit: 60,
        timeToVote: 30,
      } as TwoTruthsRound;
    }
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
    const nextRound = this.createNewRound(game.currentRound, game.players, game.gameType);
    game.rounds.push(nextRound);

    await this.redisService.saveGame(game);

    if (game.gameType === "guessio") {
      const guessioRound = nextRound as GuessioRound;
      await this.redisService.publishToGame(gameCode, "nextRound", {
        round: game.currentRound,
        prompterId: guessioRound.prompterId,
        prompterNickname: game.players.get(guessioRound.prompterId)?.nickname,
        totalRounds: game.settings.maxRounds,
      });
    } else if (game.gameType === "emojistory") {
      const emojiRound = nextRound as EmojiStoryRound;
      await this.redisService.publishToGame(gameCode, "nextRound", {
        round: game.currentRound,
        currentTurnPlayerId: emojiRound.currentTurnPlayerId,
        currentTurnNickname: game.players.get(emojiRound.currentTurnPlayerId!)?.nickname,
        totalRounds: game.settings.maxRounds,
        timePerTurn: emojiRound.timePerTurn,
      });
    } else if (game.gameType === "twotruths") {
      const twoTruthsRound = nextRound as TwoTruthsRound;
      await this.redisService.publishToGame(gameCode, "nextRound", {
        round: game.currentRound,
        currentPresenterPlayerId: twoTruthsRound.currentPresenterPlayerId,
        currentPresenterNickname: game.players.get(twoTruthsRound.currentPresenterPlayerId)?.nickname,
        totalRounds: game.settings.maxRounds,
        timeToSubmit: twoTruthsRound.timeToSubmit,
      });
    }

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

  // EmojiStory specific methods
  async submitEmojis(
    gameCode: string,
    playerId: string,
    emojis: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory" || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound || currentRound.status !== "story_building") {
      return false;
    }

    if (currentRound.currentTurnPlayerId !== playerId) {
      return false;
    }

    if (!emojis || emojis.trim().length === 0 || emojis.trim().length > 100) {
      return false;
    }

    // Add emoji contribution
    currentRound.storyContributions.push({
      playerId,
      emojis: emojis.trim(),
      turnOrder: currentRound.storyContributions.length + 1,
    });

    // Find next player
    const playerIds = Array.from(game.players.keys());
    const currentPlayerIndex = playerIds.indexOf(playerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
    
    if (currentRound.storyContributions.length >= playerIds.length) {
      // All players have contributed, move to interpretation phase
      currentRound.status = "interpreting";
      currentRound.currentTurnPlayerId = undefined;
      
      await this.redisService.saveGame(game);
      
      await this.redisService.publishToGame(gameCode, "storyComplete", {
        round: game.currentRound,
        storyContributions: currentRound.storyContributions.map(sc => ({
          playerId: sc.playerId,
          nickname: game.players.get(sc.playerId)?.nickname,
          emojis: sc.emojis,
          turnOrder: sc.turnOrder,
        })),
        timeToInterpret: 60, // 60 seconds to write interpretation
      });

      // Start interpretation timer
      setTimeout(async () => {
        await this.endInterpretationPhase(gameCode);
      }, 60000);
    } else {
      // Move to next player
      currentRound.currentTurnPlayerId = playerIds[nextPlayerIndex];
      
      await this.redisService.saveGame(game);
      
      await this.redisService.publishToGame(gameCode, "nextTurn", {
        round: game.currentRound,
        currentTurnPlayerId: playerIds[nextPlayerIndex],
        currentTurnNickname: game.players.get(playerIds[nextPlayerIndex])?.nickname,
        storyContributions: currentRound.storyContributions.map(sc => ({
          playerId: sc.playerId,
          nickname: game.players.get(sc.playerId)?.nickname,
          emojis: sc.emojis,
          turnOrder: sc.turnOrder,
        })),
        timePerTurn: currentRound.timePerTurn,
      });
    }

    console.log(`📚 Emojis submitted by ${playerId} in game ${gameCode}: "${emojis}"`);
    return true;
  }

  async submitStoryInterpretation(
    gameCode: string,
    playerId: string,
    interpretation: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory" || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound || currentRound.status !== "interpreting") {
      return false;
    }

    if (!interpretation || interpretation.trim().length === 0 || interpretation.trim().length > 500) {
      return false;
    }

    currentRound.storyInterpretations.set(playerId, interpretation.trim());
    
    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "interpretationReceived", {
      playerId,
      interpretationCount: currentRound.storyInterpretations.size,
      totalPlayers: game.players.size,
    });

    console.log(`💭 Story interpretation submitted by ${playerId} in game ${gameCode}`);

    // If all players have submitted interpretations, move to voting
    if (currentRound.storyInterpretations.size >= game.players.size) {
      await this.startVotingPhase(gameCode);
    }

    return true;
  }

  async submitVote(
    gameCode: string,
    playerId: string,
    votedForPlayerId: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory" || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound || currentRound.status !== "voting") {
      return false;
    }

    // Can't vote for yourself
    if (playerId === votedForPlayerId) {
      return false;
    }

    // Check if votedForPlayerId exists and has an interpretation
    if (!game.players.has(votedForPlayerId) || !currentRound.storyInterpretations.has(votedForPlayerId)) {
      return false;
    }

    currentRound.votes.set(playerId, votedForPlayerId);
    
    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "voteReceived", {
      playerId,
      voteCount: currentRound.votes.size,
      totalPlayers: game.players.size,
    });

    console.log(`🗳️ Vote submitted by ${playerId} for ${votedForPlayerId} in game ${gameCode}`);

    // If all players have voted, end the round
    if (currentRound.votes.size >= game.players.size) {
      await this.endEmojiStoryRound(gameCode);
    }

    return true;
  }

  private async endInterpretationPhase(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory" || game.status !== "playing") {
      return;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound || currentRound.status !== "interpreting") {
      return;
    }

    await this.startVotingPhase(gameCode);
  }

  private async startVotingPhase(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory") {
      return;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound) {
      return;
    }

    currentRound.status = "voting";
    
    await this.redisService.saveGame(game);

    const interpretations = Array.from(currentRound.storyInterpretations.entries()).map(([playerId, interpretation]) => ({
      playerId,
      nickname: game.players.get(playerId)?.nickname,
      interpretation,
    }));

    await this.redisService.publishToGame(gameCode, "votingStarted", {
      round: game.currentRound,
      interpretations,
      timeToVote: 45, // 45 seconds to vote
    });

    // Start voting timer
    setTimeout(async () => {
      await this.endEmojiStoryRound(gameCode);
    }, 45000);
  }

  private async endEmojiStoryRound(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "emojistory" || game.status !== "playing") {
      return;
    }

    const currentRound = game.rounds[game.currentRound - 1] as EmojiStoryRound;
    if (!currentRound || currentRound.status !== "voting") {
      return;
    }

    currentRound.status = "revealing";
    currentRound.endedAt = new Date();

    // Calculate scores based on votes received
    const voteCount = new Map<string, number>();
    for (const [_, votedForPlayerId] of currentRound.votes) {
      voteCount.set(votedForPlayerId, (voteCount.get(votedForPlayerId) || 0) + 1);
    }

    // Award points: 2 points per vote received
    for (const [playerId, votes] of voteCount) {
      const points = votes * 2;
      currentRound.scores.set(playerId, points);
      
      const player = game.players.get(playerId);
      if (player) {
        player.score += points;
      }
    }

    await this.redisService.saveGame(game);

    // Prepare results
    const results = {
      round: game.currentRound,
      storyContributions: currentRound.storyContributions.map(sc => ({
        playerId: sc.playerId,
        nickname: game.players.get(sc.playerId)?.nickname,
        emojis: sc.emojis,
        turnOrder: sc.turnOrder,
      })),
      interpretations: Array.from(currentRound.storyInterpretations.entries()).map(([playerId, interpretation]) => ({
        playerId,
        nickname: game.players.get(playerId)?.nickname,
        interpretation,
        votes: voteCount.get(playerId) || 0,
        points: currentRound.scores.get(playerId) || 0,
      })),
      votes: Array.from(currentRound.votes.entries()).map(([voterPlayerId, votedForPlayerId]) => ({
        voterPlayerId,
        voterNickname: game.players.get(voterPlayerId)?.nickname,
        votedForPlayerId,
        votedForNickname: game.players.get(votedForPlayerId)?.nickname,
      })),
      scores: Array.from(game.players.values())
        .map((player) => ({
          playerId: player.id,
          nickname: player.nickname,
          totalScore: player.score,
        }))
        .sort((a, b) => b.totalScore - a.totalScore),
    };

    await this.redisService.publishToGame(gameCode, "emojiStoryRoundResults", results);

    console.log(`📊 EmojiStory round ${game.currentRound} completed for game ${gameCode}`);

    // Wait 8 seconds before starting next round (longer to read results)
    setTimeout(async () => {
      await this.startNextRound(gameCode);
    }, 8000);
  }

  // TwoTruths specific methods
  async submitStatements(
    gameCode: string,
    playerId: string,
    statements: Array<{ text: string; isLie: boolean }>
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "twotruths" || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1] as TwoTruthsRound;
    if (!currentRound || currentRound.status !== "waiting_for_statements") {
      return false;
    }

    if (currentRound.currentPresenterPlayerId !== playerId) {
      return false;
    }

    if (!statements || statements.length !== 3) {
      return false;
    }

    // Validate statements
    let lieCount = 0;
    for (const statement of statements) {
      if (!statement.text || statement.text.trim().length === 0 || statement.text.trim().length > 200) {
        return false;
      }
      if (statement.isLie) lieCount++;
    }

    if (lieCount !== 1) {
      return false; // Must have exactly one lie
    }

    // Save statements with generated IDs
    currentRound.statements = statements.map((stmt, index) => ({
      id: `${playerId}_${index}`,
      text: stmt.text.trim(),
      isLie: stmt.isLie,
    }));

    currentRound.status = "voting";
    currentRound.startedAt = new Date();

    await this.redisService.saveGame(game);

    // Publish statements to all players (without the isLie flag for voters)
    const publicStatements = currentRound.statements.map(stmt => ({
      id: stmt.id,
      text: stmt.text,
    }));

    await this.redisService.publishToGame(gameCode, "statementsReady", {
      round: game.currentRound,
      presenterPlayerId: playerId,
      presenterNickname: game.players.get(playerId)?.nickname,
      statements: publicStatements,
      timeToVote: currentRound.timeToVote,
    });

    // Start voting timer
    setTimeout(async () => {
      await this.endTwoTruthsVoting(gameCode);
    }, currentRound.timeToVote * 1000);

    console.log(`📝 Statements submitted by ${playerId} in game ${gameCode}`);
    return true;
  }

  async submitTwoTruthsVote(
    gameCode: string,
    playerId: string,
    statementId: string
  ): Promise<boolean> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "twotruths" || game.status !== "playing") {
      return false;
    }

    const currentRound = game.rounds[game.currentRound - 1] as TwoTruthsRound;
    if (!currentRound || currentRound.status !== "voting") {
      return false;
    }

    // Can't vote for your own statements
    if (currentRound.currentPresenterPlayerId === playerId) {
      return false;
    }

    // Validate statement ID exists
    const statement = currentRound.statements.find(s => s.id === statementId);
    if (!statement) {
      return false;
    }

    currentRound.votes.set(playerId, statementId);
    
    await this.redisService.saveGame(game);

    await this.redisService.publishToGame(gameCode, "voteReceived", {
      playerId,
      voteCount: currentRound.votes.size,
      totalVoters: game.players.size - 1, // Excluding presenter
    });

    console.log(`🗳️ TwoTruths vote submitted by ${playerId} for statement ${statementId} in game ${gameCode}`);

    // If all players have voted, end the round
    const expectedVotes = game.players.size - 1; // Excluding presenter
    if (currentRound.votes.size >= expectedVotes) {
      await this.endTwoTruthsVoting(gameCode);
    }

    return true;
  }

  private async endTwoTruthsVoting(gameCode: string): Promise<void> {
    const game = await this.redisService.getGame(gameCode);

    if (!game || game.gameType !== "twotruths" || game.status !== "playing") {
      return;
    }

    const currentRound = game.rounds[game.currentRound - 1] as TwoTruthsRound;
    if (!currentRound || currentRound.status !== "voting") {
      return;
    }

    currentRound.status = "revealing";
    currentRound.endedAt = new Date();

    // Find the lie statement
    const lieStatement = currentRound.statements.find(s => s.isLie);
    if (!lieStatement) {
      return;
    }

    // Calculate scores
    let presenterPoints = 0;
    const voterPoints = new Map<string, number>();

    // Count votes for each statement
    const voteCount = new Map<string, number>();
    for (const [_, statementId] of currentRound.votes) {
      voteCount.set(statementId, (voteCount.get(statementId) || 0) + 1);
    }

    // Award points to voters who correctly identified the lie
    for (const [voterId, votedStatementId] of currentRound.votes) {
      if (votedStatementId === lieStatement.id) {
        voterPoints.set(voterId, 3); // 3 points for guessing the lie correctly
      } else {
        voterPoints.set(voterId, 0);
      }
    }

    // Award points to presenter based on how many people they fooled
    const lieVotes = voteCount.get(lieStatement.id) || 0;
    const totalVoters = game.players.size - 1;
    const fooledCount = totalVoters - lieVotes;
    presenterPoints = fooledCount * 2; // 2 points per person fooled

    // Update scores
    currentRound.scores.set(currentRound.currentPresenterPlayerId, presenterPoints);
    for (const [playerId, points] of voterPoints) {
      currentRound.scores.set(playerId, points);
    }

    // Update total scores
    for (const [playerId, points] of currentRound.scores) {
      const player = game.players.get(playerId);
      if (player) {
        player.score += points;
      }
    }

    await this.redisService.saveGame(game);

    // Prepare results
    const results = {
      round: game.currentRound,
      presenterPlayerId: currentRound.currentPresenterPlayerId,
      presenterNickname: game.players.get(currentRound.currentPresenterPlayerId)?.nickname,
      statements: currentRound.statements.map(stmt => ({
        id: stmt.id,
        text: stmt.text,
        isLie: stmt.isLie,
        votes: voteCount.get(stmt.id) || 0,
      })),
      votes: Array.from(currentRound.votes.entries()).map(([voterId, statementId]) => ({
        voterPlayerId: voterId,
        voterNickname: game.players.get(voterId)?.nickname,
        votedStatementId: statementId,
        wasCorrect: statementId === lieStatement.id,
      })),
      scores: Array.from(currentRound.scores.entries()).map(([playerId, points]) => ({
        playerId,
        nickname: game.players.get(playerId)?.nickname,
        roundPoints: points,
      })),
      totalScores: Array.from(game.players.values())
        .map((player) => ({
          playerId: player.id,
          nickname: player.nickname,
          totalScore: player.score,
        }))
        .sort((a, b) => b.totalScore - a.totalScore),
    };

    await this.redisService.publishToGame(gameCode, "twoTruthsRoundResults", results);

    console.log(`📊 TwoTruths round ${game.currentRound} completed for game ${gameCode}`);

    // Wait 8 seconds before starting next round
    setTimeout(async () => {
      await this.startNextRound(gameCode);
    }, 8000);
  }
}
