'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSocket } from '@/lib/SocketContext'
import { Clock, Users, Send, Trophy, Palette, Eye } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

export default function GamePlay() {
  const [promptInput, setPromptInput] = useState('')
  const [guessInput, setGuessInput] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [hasSubmittedGuess, setHasSubmittedGuess] = useState(false)
  
  const { 
    gameState, 
    playerId, 
    gameplayData, 
    roundResults, 
    submitPrompt, 
    submitGuess,
    leaveGame 
  } = useSocket()

  // Timer effect for guessing phase
  useEffect(() => {
    if (gameplayData?.gamePhase === 'guessing' && gameplayData.timeRemaining) {
      setTimeLeft(gameplayData.timeRemaining)
      
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [gameplayData?.gamePhase, gameplayData?.timeRemaining])

  // Reset guess submission state on new round
  useEffect(() => {
    if (gameplayData?.gamePhase === 'waiting_for_prompt') {
      setHasSubmittedGuess(false)
      setGuessInput('')
      setPromptInput('')
    }
  }, [gameplayData?.gamePhase])

  if (!gameState || !playerId || !gameplayData) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading game...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPrompter = gameplayData.prompterId === playerId

  const handleSubmitPrompt = () => {
    if (promptInput.trim()) {
      submitPrompt(promptInput.trim())
      setPromptInput('')
    }
  }

  const handleSubmitGuess = () => {
    if (guessInput.trim()) {
      submitGuess(guessInput.trim())
      setHasSubmittedGuess(true)
    }
  }

  // Game completed view
  if (gameplayData.gamePhase === 'completed') {
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score)
    const winner = sortedPlayers[0]
    
    return (
      <main className="container mx-auto px-4 py-8 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              🏆 Game Complete!
            </h1>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
                <h2 className="text-2xl font-bold text-yellow-800">
                  {winner.nickname} Wins!
                </h2>
                <p className="text-yellow-700">
                  Final Score: {winner.score} points
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Final Scoreboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">#{index + 1}</span>
                      <span className="font-medium">{player.nickname}</span>
                      {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                    </div>
                    <span className="font-bold text-lg">{player.score} pts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button onClick={leaveGame} variant="outline" size="lg">
              Leave Game
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Guessio - Round {gameplayData.currentRound}
          </h1>
          <div className="flex items-center justify-center gap-4">
            <Badge variant="outline">
              Game: {gameState.code}
            </Badge>
            <Badge variant="secondary">
              {gameplayData.prompterNickname} is the prompter
            </Badge>
          </div>
        </div>

        {/* Game Phase Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Waiting for Prompt */}
            {gameplayData.gamePhase === 'waiting_for_prompt' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    {isPrompter ? 'Enter Your Prompt' : 'Waiting for Prompt'}
                  </CardTitle>
                  <CardDescription>
                    {isPrompter 
                      ? 'Describe something for the AI to draw. Be creative!'
                      : `${gameplayData.prompterNickname} is choosing a prompt...`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isPrompter ? (
                    <div className="space-y-4">
                      <Input
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        placeholder="e.g. A robot painting a portrait of a dog"
                        maxLength={500}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSubmitPrompt()
                          }
                        }}
                      />
                      <Button 
                        onClick={handleSubmitPrompt}
                        disabled={!promptInput.trim()}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Prompt
                      </Button>
                      <p className="text-sm text-gray-500">
                        Tip: Be descriptive but not too obvious!
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-pulse">
                        <Palette className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                        <p className="text-gray-600">Waiting for {gameplayData.prompterNickname} to submit a prompt...</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Image Generation */}
            {gameplayData.gamePhase === 'generating_image' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    AI is Drawing...
                  </CardTitle>
                  <CardDescription>
                    Creating an image from the prompt. Get ready to guess!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <LoadingSpinner size="lg" className="mx-auto mb-4" />
                    <p className="text-gray-600">AI is generating the image...</p>
                    <p className="text-sm text-gray-500 mt-2">This usually takes a few seconds</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Guessing Phase */}
            {gameplayData.gamePhase === 'guessing' && gameplayData.imageUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Guess the Prompt!
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 5 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    What do you think the original prompt was?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gameplayData.imageUrl}
                      alt="AI Generated Image"
                      className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                    />
                  </div>
                  
                  {!isPrompter && !hasSubmittedGuess && timeLeft !== 0 && (
                    <div className="space-y-2">
                      <Input
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        placeholder="Enter your guess..."
                        maxLength={200}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSubmitGuess()
                          }
                        }}
                      />
                      <Button 
                        onClick={handleSubmitGuess}
                        disabled={!guessInput.trim()}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Guess
                      </Button>
                    </div>
                  )}
                  
                  {isPrompter && (
                    <Alert>
                      <AlertDescription>
                        You are the prompter for this round. Watch others guess your prompt!
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {hasSubmittedGuess && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        ✅ Guess submitted! Waiting for other players...
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {timeLeft === 0 && (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription className="text-orange-800">
                        ⏰ Time&apos;s up! Calculating results...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results Display */}
            {gameplayData.gamePhase === 'revealing' && roundResults && (
              <Card>
                <CardHeader>
                  <CardTitle>Round {roundResults.round} Results</CardTitle>
                  <CardDescription>
                    Original prompt: &quot;{roundResults.prompt}&quot;
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={roundResults.imageUrl}
                      alt="AI Generated Image"
                      className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Guesses & Points:</h4>
                    {roundResults.guesses
                      .sort((a, b) => b.points - a.points)
                      .map((guess, index) => (
                      <div
                        key={guess.playerId}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-green-100 border-green-300' : 'bg-gray-50'
                        }`}
                      >
                        <div>
                          <span className="font-medium">{guess.nickname}:</span>
                          <span className="ml-2 text-gray-700">&quot;{guess.guess}&quot;</span>
                        </div>
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          {guess.points} pts
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Scoreboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...gameState.players]
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 rounded ${
                        player.id === playerId ? 'bg-purple-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span className={player.id === playerId ? 'font-bold' : ''}>{player.nickname}</span>
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <span className="font-medium">{player.score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Game Info */}
            <Card>
              <CardHeader>
                <CardTitle>Game Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Round:</span>
                  <span>{gameplayData.currentRound} / {gameState.settings.maxRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span>{gameState.players.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {gameplayData.gamePhase.replace('_', ' ')}
                  </Badge>
                </div>
                {gameplayData.gamePhase === 'guessing' && gameplayData.guessCount !== undefined && (
                  <div className="flex justify-between">
                    <span>Guesses:</span>
                    <span>{gameplayData.guessCount} / {gameplayData.totalGuessers}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={leaveGame} variant="outline" className="w-full">
              Leave Game
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}