import { Game } from "../types/Game";

interface StoredGame {
  game: Game;
  expiresAt: number;
}

export class MemoryStore {
  private games: Map<string, StoredGame> = new Map();
  private subscribers: Map<string, Set<(event: string, data: any) => void>> =
    new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    console.log("🧠 Using in-memory storage for game data");
  }

  async saveGame(game: Game): Promise<void> {
    const key = `game:${game.code}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    this.games.set(key, {
      game: this.deepClone(game),
      expiresAt,
    });
  }

  async getGame(gameCode: string): Promise<Game | null> {
    const key = `game:${gameCode}`;
    const stored = this.games.get(key);

    if (!stored) {
      return null;
    }

    if (Date.now() > stored.expiresAt) {
      this.games.delete(key);
      return null;
    }

    return this.deepClone(stored.game);
  }

  async deleteGame(gameCode: string): Promise<void> {
    const key = `game:${gameCode}`;
    this.games.delete(key);
  }

  async gameExists(gameCode: string): Promise<boolean> {
    const key = `game:${gameCode}`;
    const stored = this.games.get(key);

    if (!stored) {
      return false;
    }

    if (Date.now() > stored.expiresAt) {
      this.games.delete(key);
      return false;
    }

    return true;
  }

  async publishToGame(
    gameCode: string,
    event: string,
    data: any
  ): Promise<void> {
    const channel = `game:${gameCode}`;
    const subscribers = this.subscribers.get(channel);

    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(event, data);
        } catch (error) {
          console.error("Error in subscriber callback:", error);
        }
      });
    }
  }

  async subscribeToGame(
    gameCode: string,
    callback: (event: string, data: any) => void
  ): Promise<void> {
    const channel = `game:${gameCode}`;

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(callback);
    console.log(`📡 Subscribed to ${channel} (in-memory)`);
  }

  async unsubscribeFromGame(gameCode: string): Promise<void> {
    const channel = `game:${gameCode}`;
    this.subscribers.delete(channel);
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, stored] of this.games.entries()) {
      if (now > stored.expiresAt) {
        this.games.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`🧹 Cleaned up ${expiredCount} expired games`);
    }
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Map) {
      const clonedMap = new Map();
      for (const [key, value] of obj.entries()) {
        clonedMap.set(key, this.deepClone(value));
      }
      return clonedMap as unknown as T;
    }

    if (obj instanceof Set) {
      const clonedSet = new Set();
      for (const value of obj.values()) {
        clonedSet.add(this.deepClone(value));
      }
      return clonedSet as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }

    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }

    return clonedObj;
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.games.clear();
    this.subscribers.clear();
  }
}
