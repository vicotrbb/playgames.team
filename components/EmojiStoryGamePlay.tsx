'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSocket } from '@/lib/SocketContext'
import { Clock, Users, Send, Trophy, BookOpen, Vote, PenTool } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface StoryContribution {
  playerId: string;
  nickname: string;
  emojis: string;
  turnOrder: number;
}

interface StoryInterpretation {
  playerId: string;
  nickname: string;
  interpretation: string;
}

interface EmojiStoryData {
  currentRound: number;
  currentTurnPlayerId?: string;
  currentTurnNickname?: string;
  gamePhase: 'story_building' | 'interpreting' | 'voting' | 'revealing' | 'completed';
  timePerTurn: number;
  storyContributions: StoryContribution[];
  interpretations?: StoryInterpretation[];
}

interface EmojiStoryResults {
  round: number;
  storyContributions: StoryContribution[];
  interpretations: Array<{
    playerId: string;
    nickname: string;
    interpretation: string;
    votes: number;
    points: number;
  }>;
  votes: Array<{
    voterPlayerId: string;
    voterNickname: string;
    votedForPlayerId: string;
    votedForNickname: string;
  }>;
  scores: Array<{
    playerId: string;
    nickname: string;
    totalScore: number;
  }>;
}

export default function EmojiStoryGamePlay() {
  const [emojiInput, setEmojiInput] = useState('')
  const [interpretationInput, setInterpretationInput] = useState('')
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [hasSubmittedEmojis, setHasSubmittedEmojis] = useState(false)
  const [hasSubmittedInterpretation, setHasSubmittedInterpretation] = useState(false)
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false)
  
  const { 
    gameState, 
    playerId, 
    socket,
    submitEmojis,
    submitStoryInterpretation,
    submitVote,
    leaveGame 
  } = useSocket()

  // State for EmojiStory specific data
  const [emojiStoryData, setEmojiStoryData] = useState<EmojiStoryData | null>(null)
  const [emojiStoryResults, setEmojiStoryResults] = useState<EmojiStoryResults | null>(null)

  // Listen to EmojiStory specific events
  useEffect(() => {
    if (!socket) return

    const handleGameStarted = (data: { round: number; currentTurnPlayerId: string; currentTurnNickname: string; timePerTurn: number }) => {
      setEmojiStoryData({
        currentRound: data.round,
        currentTurnPlayerId: data.currentTurnPlayerId,
        currentTurnNickname: data.currentTurnNickname,
        gamePhase: 'story_building',
        timePerTurn: data.timePerTurn,
        storyContributions: [],
      })
      setTimeLeft(data.timePerTurn)
    }

    const handleNextTurn = (data: { currentTurnPlayerId: string; currentTurnNickname: string; storyContributions: StoryContribution[]; timePerTurn: number }) => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        currentTurnPlayerId: data.currentTurnPlayerId,
        currentTurnNickname: data.currentTurnNickname,
        storyContributions: data.storyContributions,
      }) : null)
      setTimeLeft(data.timePerTurn)
      setHasSubmittedEmojis(false)
    }

    const handleStoryComplete = (data: { storyContributions: StoryContribution[]; timeToInterpret: number }) => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        gamePhase: 'interpreting' as const,
        storyContributions: data.storyContributions,
      }) : null)
      setTimeLeft(data.timeToInterpret)
      setHasSubmittedEmojis(false)
    }

    const handleVotingStarted = (data: { interpretations: StoryInterpretation[]; timeToVote: number }) => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        gamePhase: 'voting' as const,
        interpretations: data.interpretations,
      }) : null)
      setTimeLeft(data.timeToVote)
      setHasSubmittedInterpretation(false)
    }

    const handleEmojiStoryRoundResults = (data: EmojiStoryResults) => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        gamePhase: 'revealing' as const,
      }) : null)
      setEmojiStoryResults(data)
      setHasSubmittedVote(false)
    }

    const handleNextRound = (data: { round: number; currentTurnPlayerId: string; currentTurnNickname: string; timePerTurn: number }) => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        currentRound: data.round,
        currentTurnPlayerId: data.currentTurnPlayerId,
        currentTurnNickname: data.currentTurnNickname,
        gamePhase: 'story_building' as const,
        storyContributions: [],
        interpretations: [],
      }) : null)
      setEmojiStoryResults(null)
      setTimeLeft(data.timePerTurn)
      setHasSubmittedEmojis(false)
      setHasSubmittedInterpretation(false)
      setHasSubmittedVote(false)
    }

    const handleGameEnd = () => {
      setEmojiStoryData((prev) => prev ? ({
        ...prev,
        gamePhase: 'completed' as const,
      }) : null)
    }

    socket.on('gameStarted', handleGameStarted)
    socket.on('nextTurn', handleNextTurn)
    socket.on('storyComplete', handleStoryComplete)
    socket.on('votingStarted', handleVotingStarted)
    socket.on('emojiStoryRoundResults', handleEmojiStoryRoundResults)
    socket.on('nextRound', handleNextRound)
    socket.on('gameEnd', handleGameEnd)

    return () => {
      socket.off('gameStarted', handleGameStarted)
      socket.off('nextTurn', handleNextTurn)
      socket.off('storyComplete', handleStoryComplete)
      socket.off('votingStarted', handleVotingStarted)
      socket.off('emojiStoryRoundResults', handleEmojiStoryRoundResults)
      socket.off('nextRound', handleNextRound)
      socket.off('gameEnd', handleGameEnd)
    }
  }, [socket])

  // Timer effect
  useEffect(() => {
    if (timeLeft && timeLeft > 0) {
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
  }, [timeLeft])

  if (!gameState || !playerId || !emojiStoryData) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading Emoji Story...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCurrentTurn = emojiStoryData.currentTurnPlayerId === playerId

  const handleSubmitEmojis = () => {
    if (emojiInput.trim()) {
      submitEmojis(emojiInput.trim())
      setHasSubmittedEmojis(true)
      setEmojiInput('')
    }
  }

  const handleSubmitInterpretation = () => {
    if (interpretationInput.trim()) {
      submitStoryInterpretation(interpretationInput.trim())
      setHasSubmittedInterpretation(true)
      setInterpretationInput('')
    }
  }

  const handleSubmitVote = (votedForPlayerId: string) => {
    submitVote(votedForPlayerId)
    setSelectedVote(votedForPlayerId)
    setHasSubmittedVote(true)
  }

  // Game completed view
  if (emojiStoryData.gamePhase === 'completed') {
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
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              📚
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Emoji Story - Round {emojiStoryData.currentRound}
            </h1>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Badge variant="outline">
              Game: {gameState.code}
            </Badge>
            {emojiStoryData.gamePhase === 'story_building' && (
              <Badge variant="secondary">
                {emojiStoryData.currentTurnNickname}&apos;s turn
              </Badge>
            )}
          </div>
        </div>

        {/* Game Phase Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Story Building Phase */}
            {emojiStoryData.gamePhase === 'story_building' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Building the Story
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 5 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isCurrentTurn 
                      ? 'Add 2-5 emojis to continue the story!'
                      : `Waiting for ${emojiStoryData.currentTurnNickname} to add emojis...`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Story Display */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Story so far:</h4>
                    <div className="text-2xl leading-relaxed">
                      {emojiStoryData.storyContributions.length === 0 ? (
                        <span className="text-gray-500 text-base">Story will appear here as players add emojis...</span>
                      ) : (
                        emojiStoryData.storyContributions
                          .sort((a, b) => a.turnOrder - b.turnOrder)
                          .map((contrib, index) => (
                            <span key={index} className="inline-block mr-2">
                              {contrib.emojis}
                              {index < emojiStoryData.storyContributions.length - 1 && ' '}
                            </span>
                          ))
                      )}
                    </div>
                  </div>

                  {isCurrentTurn && !hasSubmittedEmojis && timeLeft !== 0 ? (
                    <div className="space-y-4">
                      <Input
                        value={emojiInput}
                        onChange={(e) => setEmojiInput(e.target.value)}
                        placeholder="Add 2-5 emojis to continue the story... 🏠🐕🌟"
                        maxLength={100}
                        className="text-lg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSubmitEmojis()
                          }
                        }}
                      />
                      <Button 
                        onClick={handleSubmitEmojis}
                        disabled={!emojiInput.trim()}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Add to Story
                      </Button>
                      <p className="text-sm text-gray-500">
                        Tip: Use 2-5 emojis that continue or add to the story!
                      </p>
                    </div>
                  ) : !isCurrentTurn ? (
                    <div className="text-center py-4">
                      <div className="animate-pulse">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                        <p className="text-gray-600">Waiting for {emojiStoryData.currentTurnNickname} to add emojis...</p>
                      </div>
                    </div>
                  ) : hasSubmittedEmojis ? (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        ✅ Emojis submitted! Waiting for other players...
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription className="text-orange-800">
                        ⏰ Time&apos;s up! Moving to next player...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Interpretation Phase */}
            {emojiStoryData.gamePhase === 'interpreting' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    Interpret the Story
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Write what you think this emoji story means!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Complete Story Display */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Complete story:</h4>
                    <div className="text-3xl leading-relaxed mb-4">
                      {emojiStoryData.storyContributions
                        .sort((a, b) => a.turnOrder - b.turnOrder)
                        .map((contrib, index) => (
                          <span key={index} className="inline-block mr-2">
                            {contrib.emojis}
                          </span>
                        ))}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Contributors: {emojiStoryData.storyContributions.map((c) => c.nickname).join(', ')}</p>
                    </div>
                  </div>

                  {!hasSubmittedInterpretation && timeLeft !== 0 ? (
                    <div className="space-y-4">
                      <Textarea
                        value={interpretationInput}
                        onChange={(e) => setInterpretationInput(e.target.value)}
                        placeholder="What story do you think these emojis tell? Be creative!"
                        maxLength={500}
                        rows={4}
                      />
                      <Button 
                        onClick={handleSubmitInterpretation}
                        disabled={!interpretationInput.trim()}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Interpretation
                      </Button>
                    </div>
                  ) : hasSubmittedInterpretation ? (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        ✅ Interpretation submitted! Waiting for other players...
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertDescription className="text-orange-800">
                        ⏰ Time&apos;s up! Moving to voting...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Voting Phase */}
            {emojiStoryData.gamePhase === 'voting' && emojiStoryData.interpretations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    Vote for Best Interpretation
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Which interpretation do you think is the best or funniest?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Story Display */}
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-2xl mb-2">
                      {emojiStoryData.storyContributions
                        .sort((a, b) => a.turnOrder - b.turnOrder)
                        .map((contrib, index) => (
                          <span key={index} className="inline-block mr-1">
                            {contrib.emojis}
                          </span>
                        ))}
                    </div>
                  </div>

                  {!hasSubmittedVote && timeLeft !== 0 ? (
                    <div className="space-y-3">
                      {emojiStoryData.interpretations
                        ?.filter((interp) => interp.playerId !== playerId) // Can't vote for yourself
                        .map((interpretation, index) => (
                        <div
                          key={interpretation.playerId}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedVote === interpretation.playerId
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => handleSubmitVote(interpretation.playerId)}
                        >
                          <div className="font-medium text-blue-800 mb-1">
                            Anonymous Interpretation #{index + 1}
                          </div>
                          <p className="text-gray-700">{interpretation.interpretation}</p>
                        </div>
                      ))}
                      <p className="text-sm text-gray-500 text-center">
                        Click on an interpretation to vote for it!
                      </p>
                    </div>
                  ) : hasSubmittedVote ? (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        ✅ Vote submitted! Waiting for other players...
                      </AlertDescription>
                    </Alert>
                  ) : (
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
            {emojiStoryData.gamePhase === 'revealing' && emojiStoryResults && (
              <Card>
                <CardHeader>
                  <CardTitle>Round {emojiStoryResults.round} Results</CardTitle>
                  <CardDescription>
                    See how everyone interpreted the story!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Story Display */}
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <h4 className="font-medium mb-2">The Story:</h4>
                    <div className="text-3xl mb-3">
                      {emojiStoryResults.storyContributions
                        .sort((a, b) => a.turnOrder - b.turnOrder)
                        .map((contrib, index) => (
                          <span key={index} className="inline-block mr-2">
                            {contrib.emojis}
                          </span>
                        ))}
                    </div>
                    <p className="text-sm text-gray-600">
                      Contributors: {emojiStoryResults.storyContributions.map((c) => c.nickname).join(' → ')}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">Interpretations & Votes:</h4>
                    {emojiStoryResults.interpretations
                      .sort((a, b) => b.votes - a.votes)
                      .map((interpretation, index) => (
                      <div
                        key={interpretation.playerId}
                        className={`p-4 rounded-lg ${
                          index === 0 && interpretation.votes > 0 ? 'bg-green-100 border-green-300' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{interpretation.nickname}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={index === 0 && interpretation.votes > 0 ? 'default' : 'secondary'}>
                              {interpretation.votes} vote{interpretation.votes !== 1 ? 's' : ''}
                            </Badge>
                            <Badge variant="outline">
                              +{interpretation.points} pts
                            </Badge>
                          </div>
                        </div>
                        <p className="text-gray-700">{interpretation.interpretation}</p>
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
                        player.id === playerId ? 'bg-blue-100' : 'bg-gray-50'
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
                  <span>{emojiStoryData.currentRound} / {gameState.settings.maxRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span>{gameState.players.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phase:</span>
                  <Badge variant="outline" className="text-xs">
                    {emojiStoryData.gamePhase.replace('_', ' ')}
                  </Badge>
                </div>
                {emojiStoryData.gamePhase === 'story_building' && (
                  <div className="flex justify-between">
                    <span>Turn:</span>
                    <span>{emojiStoryData.currentTurnNickname}</span>
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