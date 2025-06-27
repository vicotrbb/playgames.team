export type GameType = "guessio" | "emojistory" | "twotruths";

export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: Date;
}

// Base round interface for common properties
export interface BaseRound {
  roundNumber: number;
  status: string;
  startedAt?: Date;
  endedAt?: Date;
}

// Guessio specific round
export interface GuessioRound extends BaseRound {
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
}

// EmojiStory specific round
export interface EmojiStoryRound extends BaseRound {
  storyContributions: Array<{
    playerId: string;
    emojis: string;
    turnOrder: number;
  }>;
  storyInterpretations: Map<string, string>;
  votes: Map<string, string>; // playerId -> votedForPlayerId
  scores: Map<string, number>;
  status:
    | "waiting_for_turn"
    | "story_building"
    | "interpreting"
    | "voting"
    | "revealing"
    | "completed";
  currentTurnPlayerId?: string;
  timePerTurn: number; // seconds
}

// TwoTruths specific round
export interface TwoTruthsRound extends BaseRound {
  currentPresenterPlayerId: string;
  statements: Array<{
    id: string;
    text: string;
    isLie: boolean;
  }>;
  votes: Map<string, string>; // voterPlayerId -> votedStatementId
  scores: Map<string, number>;
  status:
    | "waiting_for_statements"
    | "voting"
    | "revealing"
    | "completed";
  timeToSubmit: number; // seconds
  timeToVote: number; // seconds
}

export type GameRound = GuessioRound | EmojiStoryRound | TwoTruthsRound;

export interface Game {
  code: string;
  gameType: GameType;
  players: Map<string, Player>;
  rounds: GameRound[];
  currentRound: number;
  status: "lobby" | "playing" | "completed";
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
  settings: {
    maxRounds: number;
    guessingTimeLimit?: number; // seconds (for Guessio)
    timePerTurn?: number; // seconds (for EmojiStory)
    timeToSubmitStatements?: number; // seconds (for TwoTruths)
    timeToVote?: number; // seconds (for TwoTruths)
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
