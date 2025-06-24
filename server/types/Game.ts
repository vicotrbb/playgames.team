export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: Date;
}

export interface GameRound {
  roundNumber: number;
  prompterId: string;
  prompt?: string;
  imageUrl?: string;
  guesses: Map<string, string>;
  scores: Map<string, number>;
  status:
    | "waiting_for_prompt"
    | "generating_image"
    | "guessing"
    | "revealing"
    | "completed";
  startedAt?: Date;
  endedAt?: Date;
}

export interface Game {
  code: string;
  players: Map<string, Player>;
  rounds: GameRound[];
  currentRound: number;
  status: "lobby" | "playing" | "completed";
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
  settings: {
    maxRounds: number;
    guessingTimeLimit: number; // seconds
  };
}

export interface JoinGameResult {
  success: boolean;
  game?: Game;
  error?: string;
}

export interface CreateGameResult {
  success: boolean;
  game?: Game;
  error?: string;
}
