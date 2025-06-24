"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSocket } from "@/lib/SocketContext";
import GameLobby from "@/components/GameLobby";
import { DebugInfo } from "@/components/DebugInfo";

export default function Home() {
  const [gameCode, setGameCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const { gameState, error, createGame, joinGame } = useSocket();

  if (gameState) {
    return <GameLobby />;
  }

  const handleCreateGame = async () => {
    if (!nickname.trim()) {
      return;
    }

    setIsCreating(true);
    const success = await createGame(nickname.trim());
    setIsCreating(false);

    if (!success) {
      // Error will be shown via the error state
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode.trim() || !nickname.trim()) {
      return;
    }

    setIsJoining(true);
    const success = await joinGame(gameCode.trim(), nickname.trim());
    setIsJoining(false);

    if (!success) {
      // Error will be shown via the error state
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Playgames
          </h1>
          <p className="text-gray-600">
            Play fun party games with your friends!
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Guessio</CardTitle>
            <CardDescription>
              AI generates images from prompts, and you guess what the prompt
              was!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="nickname"
                className="text-sm font-medium text-gray-700"
              >
                Your Nickname
              </label>
              <Input
                id="nickname"
                type="text"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
              />
            </div>

            <Button
              onClick={handleCreateGame}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
              disabled={!nickname.trim() || isCreating}
            >
              {isCreating ? "🎮 Creating..." : "🎮 Start New Game"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or join existing game
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                className="text-center"
                maxLength={6}
              />
              <Button
                onClick={handleJoinGame}
                variant="outline"
                className="w-full"
                disabled={!gameCode.trim() || !nickname.trim() || isJoining}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500">
          <p>No account needed • Games last 24 hours • Up to 50 players</p>
        </div>
      </div>
      <DebugInfo />
    </main>
  );
}
