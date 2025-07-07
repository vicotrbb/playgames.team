import Redis from "ioredis";
import { Game, Player } from "../types/Game";
import { MemoryStore } from "./MemoryStore";

export class RedisService {
  private redis: Redis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private memoryStore: MemoryStore | null = null;
  private useMemoryFallback: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

    if (!redisUrl) {
      console.warn("⚠️  No Redis URL found. Using in-memory fallback.");
      this.useMemoryFallback = true;
      this.memoryStore = new MemoryStore();
    } else {
      this.setupRedis(redisUrl);
    }
  }

  private setupRedis(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);

    this.redis.on("error", (err) => {
      console.error("Redis connection error:", err);
      if (!this.useMemoryFallback) {
        console.log("🔄 Switching to in-memory fallback");
        this.useMemoryFallback = true;
        this.memoryStore = new MemoryStore();
      }
    });

    this.redis.on("connect", () => {
      console.log("✅ Connected to Redis");
      this.useMemoryFallback = false;
    });
  }

  // Game storage methods
  async saveGame(game: Game): Promise<void> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.saveGame(game);
    }

    if (!this.redis) {
      throw new Error("Redis not available and no memory fallback");
    }

    const key = `game:${game.code}`;
    const gameData = this.serializeGame(game);

    await this.redis.hset(key, gameData);
    await this.redis.expire(key, 86400);
  }

  async getGame(gameCode: string): Promise<Game | null> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.getGame(gameCode);
    }

    if (!this.redis) {
      return null;
    }

    const key = `game:${gameCode}`;
    const gameData = await this.redis.hgetall(key);

    if (!gameData || Object.keys(gameData).length === 0) {
      return null;
    }

    return this.deserializeGame(gameData);
  }

  async deleteGame(gameCode: string): Promise<void> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.deleteGame(gameCode);
    }

    if (!this.redis) {
      return;
    }

    const key = `game:${gameCode}`;
    await this.redis.del(key);
  }

  async gameExists(gameCode: string): Promise<boolean> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.gameExists(gameCode);
    }

    if (!this.redis) {
      return false;
    }

    const key = `game:${gameCode}`;
    return (await this.redis.exists(key)) === 1;
  }

  // Pub/Sub methods for real-time events
  async publishToGame(
    gameCode: string,
    event: string,
    data: any
  ): Promise<void> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.publishToGame(gameCode, event, data);
    }

    if (!this.pubClient) {
      return;
    }

    const channel = `game:${gameCode}`;
    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    await this.pubClient.publish(channel, message);
  }

  async subscribeToGame(
    gameCode: string,
    callback: (event: string, data: any) => void
  ): Promise<void> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.subscribeToGame(gameCode, callback);
    }

    if (!this.subClient) {
      return;
    }

    const channel = `game:${gameCode}`;

    this.subClient.subscribe(channel, (err, count) => {
      if (err) {
        console.error("Redis subscribe error:", err);
        return;
      }
      console.log(`📡 Subscribed to ${channel}`);
    });

    this.subClient.on("message", (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const { event, data } = JSON.parse(message);
          callback(event, data);
        } catch (error) {
          console.error("Error parsing Redis message:", error);
        }
      }
    });
  }

  async unsubscribeFromGame(gameCode: string): Promise<void> {
    if (this.useMemoryFallback && this.memoryStore) {
      return this.memoryStore.unsubscribeFromGame(gameCode);
    }

    if (!this.subClient) {
      return;
    }

    const channel = `game:${gameCode}`;
    await this.subClient.unsubscribe(channel);
  }

  private serializeGame(game: Game): Record<string, string> {
    return {
      code: game.code,
      gameType: game.gameType,
      players: JSON.stringify(Array.from(game.players.entries())),
      rounds: JSON.stringify(
        game.rounds.map((round) => {
          const serializedRound: any = { ...round };
          
          // Handle different round types with their specific Map properties
          if ('guesses' in round && round.guesses instanceof Map) {
            serializedRound.guesses = Array.from(round.guesses.entries());
          }
          if ('scores' in round && round.scores instanceof Map) {
            serializedRound.scores = Array.from(round.scores.entries());
          }
          if ('votes' in round && round.votes instanceof Map) {
            serializedRound.votes = Array.from(round.votes.entries());
          }
          if ('storyInterpretations' in round && round.storyInterpretations instanceof Map) {
            serializedRound.storyInterpretations = Array.from(round.storyInterpretations.entries());
          }
          
          return serializedRound;
        })
      ),
      currentRound: game.currentRound.toString(),
      status: game.status,
      maxPlayers: game.maxPlayers.toString(),
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
      settings: JSON.stringify(game.settings),
    };
  }

  private deserializeGame(data: Record<string, string>): Game {
    const players = new Map<string, Player>();
    JSON.parse(data.players).forEach(([id, player]: [string, Player]) => {
      players.set(id, {
        ...player,
        joinedAt: new Date(player.joinedAt),
      });
    });

    const rounds = JSON.parse(data.rounds).map((round: any) => {
      const deserializedRound: any = {
        ...round,
        startedAt: round.startedAt ? new Date(round.startedAt) : undefined,
        endedAt: round.endedAt ? new Date(round.endedAt) : undefined,
      };
      
      // Handle different round types with their specific Map properties
      if (round.guesses && Array.isArray(round.guesses)) {
        deserializedRound.guesses = new Map(round.guesses);
      }
      if (round.scores && Array.isArray(round.scores)) {
        deserializedRound.scores = new Map(round.scores);
      }
      if (round.votes && Array.isArray(round.votes)) {
        deserializedRound.votes = new Map(round.votes);
      }
      if (round.storyInterpretations && Array.isArray(round.storyInterpretations)) {
        deserializedRound.storyInterpretations = new Map(round.storyInterpretations);
      }
      
      return deserializedRound;
    });

    return {
      code: data.code,
      gameType: data.gameType as Game["gameType"],
      players,
      rounds,
      currentRound: parseInt(data.currentRound),
      status: data.status as Game["status"],
      maxPlayers: parseInt(data.maxPlayers),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      settings: JSON.parse(data.settings),
    };
  }

  async close(): Promise<void> {
    if (this.memoryStore) {
      this.memoryStore.close();
    }

    if (this.redis && this.pubClient && this.subClient) {
      await Promise.all([
        this.redis.quit(),
        this.pubClient.quit(),
        this.subClient.quit(),
      ]);
    }
  }
}
