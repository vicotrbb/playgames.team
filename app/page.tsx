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
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const { gameState, error, createGame, joinGame } = useSocket();

  if (gameState) {
    return <GameLobby />;
  }

  const handleCreateGame = async () => {
    if (!nickname.trim() || !selectedGame) {
      return;
    }

    setIsCreating(true);
    const success = await createGame(nickname.trim(), selectedGame as "guessio" | "emojistory" | "twotruths");
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

  const handleSelectGame = (gameId: string) => {
    setSelectedGame(gameId);
  };

  const handleBackToGames = () => {
    setSelectedGame(null);
    setGameCode("");
    setNickname("");
  };

  // Show game selection if no game is selected
  if (!selectedGame) {
    return (
      <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Play Games
            </h1>
            <p className="text-xl text-gray-600">
              Choose your adventure! Play fun party games with friends.
            </p>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6">
            {/* Guessio Game Card */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      🎨
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Guessio</CardTitle>
                      <CardDescription className="text-base">
                        AI Image Guessing Game
                      </CardDescription>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Available
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  AI generates images from secret prompts, and you guess what the prompt was! 
                  Score points based on how close your guess is to the original.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">2-50 players</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">15 sec rounds</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">AI scoring</span>
                </div>
                <Button 
                  onClick={() => handleSelectGame('guessio')}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  Play Guessio 🎨
                </Button>
              </CardContent>
            </Card>

            {/* EmojiStory Game Card */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      📚
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Emoji Story</CardTitle>
                      <CardDescription className="text-base">
                        Collaborative Storytelling
                      </CardDescription>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Available
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Build a story together using only emojis! Each player adds to the tale, 
                  then everyone writes what they think the story means. Vote for the best interpretation!
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">2-20 players</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">30 sec turns</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Creative fun</span>
                </div>
                <Button 
                  onClick={() => handleSelectGame('emojistory')}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  size="lg"
                >
                  Play Emoji Story 📚
                </Button>
              </CardContent>
            </Card>

            {/* TwoTruths Game Card */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      🕵️
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Two Truths and a Lie</CardTitle>
                      <CardDescription className="text-base">
                        Deception & Detection
                      </CardDescription>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Available
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Each player presents 3 statements - 2 truths and 1 lie. 
                  Can you spot the lie? Score points for fooling others and detecting their lies!
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">2-10 players</span>
                  <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-sm">60 sec rounds</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Social fun</span>
                </div>
                <Button 
                  onClick={() => handleSelectGame('twotruths')}
                  className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                  size="lg"
                >
                  Play Two Truths 🕵️
                </Button>
              </CardContent>
            </Card>

            {/* Coming Soon Games */}
            <Card className="opacity-60">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      🎯
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-gray-500">More Games</CardTitle>
                      <CardDescription className="text-base">
                        Coming Soon
                      </CardDescription>
                    </div>
                  </div>
                  <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                    Coming Soon
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  We&apos;re working on more exciting party games! Stay tuned for updates.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>No account needed • Games last 24 hours • Real-time multiplayer</p>
          </div>
        </div>
        <DebugInfo />
      </main>
    );
  }

  // Show selected game interface
  return (
    <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToGames}
              className="text-purple-600 hover:text-purple-700"
            >
              ← Back to Games
            </Button>
          </div>
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className={`w-8 h-8 bg-gradient-to-br ${
              selectedGame === 'guessio' 
                ? 'from-purple-500 to-pink-500' 
                : selectedGame === 'emojistory'
                ? 'from-blue-500 to-cyan-500'
                : 'from-green-500 to-teal-500'
            } rounded-lg flex items-center justify-center text-white text-sm font-bold`}>
              {selectedGame === 'guessio' ? '🎨' : selectedGame === 'emojistory' ? '📚' : '🕵️'}
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {selectedGame === 'guessio' ? 'Guessio' : selectedGame === 'emojistory' ? 'Emoji Story' : 'Two Truths and a Lie'}
            </h1>
          </div>
          <p className="text-gray-600">
            {selectedGame === 'guessio' 
              ? 'AI generates images from prompts, and you guess what the prompt was!'
              : selectedGame === 'emojistory'
              ? 'Build stories with emojis and guess what they mean!'
              : 'Each player presents 3 statements - 2 truths and 1 lie. Can you spot the lie?'}
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
            <CardTitle>Join the Fun!</CardTitle>
            <CardDescription>
              Enter your nickname to create or join a {selectedGame === 'guessio' ? 'Guessio' : selectedGame === 'emojistory' ? 'Emoji Story' : 'Two Truths and a Lie'} game
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
              className={`w-full bg-gradient-to-r ${
                selectedGame === 'guessio'
                  ? 'from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : selectedGame === 'emojistory'
                  ? 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                  : 'from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700'
              }`}
              size="lg"
              disabled={!nickname.trim() || isCreating}
            >
              {isCreating ? "🎮 Creating..." : "🎮 Create New Game"}
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
                className="w-full hover:bg-purple-50 hover:border-purple-300"
                disabled={!gameCode.trim() || !nickname.trim() || isJoining}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500">
          <p>
            {selectedGame === 'guessio' 
              ? '2-50 players • 15 second rounds • AI-powered scoring'
              : selectedGame === 'emojistory'
              ? '2-20 players • 30 second turns • Creative storytelling'
              : '2-10 players • 60 second rounds • Social deduction'}
          </p>
        </div>
      </div>
      <DebugInfo />
    </main>
  );
}
