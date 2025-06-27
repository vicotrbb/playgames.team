'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSocket } from '@/lib/SocketContext'
import { Clock, Users, Send, Trophy, PenTool, Vote, CheckCircle, XCircle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface TwoTruthsStatement {
  id: string;
  text: string;
  isLie?: boolean; // Only available in results
  votes?: number; // Only available in results
}

interface TwoTruthsData {
  currentRound: number;
  currentPresenterPlayerId?: string;
  currentPresenterNickname?: string;
  gamePhase: 'waiting_for_statements' | 'voting' | 'revealing' | 'completed';
  timeToSubmit?: number;
  timeToVote?: number;
  statements?: TwoTruthsStatement[];
}

interface TwoTruthsResults {
  round: number;
  presenterPlayerId: string;
  presenterNickname: string;
  statements: Array<{
    id: string;
    text: string;
    isLie: boolean;
    votes: number;
  }>;
  votes: Array<{
    voterPlayerId: string;
    voterNickname: string;
    votedStatementId: string;
    wasCorrect: boolean;
  }>;
  scores: Array<{
    playerId: string;
    nickname: string;
    roundPoints: number;
  }>;
  totalScores: Array<{
    playerId: string;
    nickname: string;
    totalScore: number;
  }>;
}

export default function TwoTruthsGamePlay() {
  const [statementInputs, setStatementInputs] = useState(['', '', ''])
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null)
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [hasSubmittedStatements, setHasSubmittedStatements] = useState(false)
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false)
  
  const { 
    gameState, 
    playerId, 
    socket,
    submitStatements,
    submitTwoTruthsVote,
    leaveGame 
  } = useSocket()

  // State for TwoTruths specific data
  const [twoTruthsData, setTwoTruthsData] = useState<TwoTruthsData | null>(null)
  const [twoTruthsResults, setTwoTruthsResults] = useState<TwoTruthsResults | null>(null)

  // Listen to TwoTruths specific events
  useEffect(() => {
    if (!socket) return

    const handleGameStarted = (data: { round: number; currentPresenterPlayerId: string; currentPresenterNickname: string; timeToSubmit: number }) => {
      setTwoTruthsData({
        currentRound: data.round,
        currentPresenterPlayerId: data.currentPresenterPlayerId,
        currentPresenterNickname: data.currentPresenterNickname,
        gamePhase: 'waiting_for_statements',
        timeToSubmit: data.timeToSubmit,
      })
      setTimeLeft(data.timeToSubmit)
    }

    const handleStatementsReady = (data: { 
      round: number; 
      presenterPlayerId: string; 
      presenterNickname: string; 
      statements: TwoTruthsStatement[]; 
      timeToVote: number 
    }) => {
      setTwoTruthsData((prev) => prev ? ({
        ...prev,
        gamePhase: 'voting' as const,
        statements: data.statements,
        timeToVote: data.timeToVote,
      }) : null)
      setTimeLeft(data.timeToVote)
      setHasSubmittedStatements(false)
    }

    const handleTwoTruthsRoundResults = (data: TwoTruthsResults) => {
      setTwoTruthsData((prev) => prev ? ({
        ...prev,
        gamePhase: 'revealing' as const,
      }) : null)
      setTwoTruthsResults(data)
      setHasSubmittedVote(false)
    }

    const handleNextRound = (data: { round: number; currentPresenterPlayerId: string; currentPresenterNickname: string; timeToSubmit: number }) => {
      setTwoTruthsData((prev) => prev ? ({
        ...prev,
        currentRound: data.round,
        currentPresenterPlayerId: data.currentPresenterPlayerId,
        currentPresenterNickname: data.currentPresenterNickname,
        gamePhase: 'waiting_for_statements' as const,
        timeToSubmit: data.timeToSubmit,
        statements: undefined,
      }) : null)
      setTwoTruthsResults(null)
      setTimeLeft(data.timeToSubmit)
      setHasSubmittedStatements(false)
      setHasSubmittedVote(false)
      setStatementInputs(['', '', ''])
      setSelectedLieIndex(null)
      setSelectedVote(null)
    }

    const handleGameEnd = () => {
      setTwoTruthsData((prev) => prev ? ({
        ...prev,
        gamePhase: 'completed' as const,
      }) : null)
    }

    socket.on('gameStarted', handleGameStarted)
    socket.on('statementsReady', handleStatementsReady)
    socket.on('twoTruthsRoundResults', handleTwoTruthsRoundResults)
    socket.on('nextRound', handleNextRound)
    socket.on('gameEnd', handleGameEnd)

    return () => {
      socket.off('gameStarted', handleGameStarted)
      socket.off('statementsReady', handleStatementsReady)
      socket.off('twoTruthsRoundResults', handleTwoTruthsRoundResults)
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

  if (!gameState || !playerId || !twoTruthsData) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading Two Truths and a Lie...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCurrentPresenter = twoTruthsData.currentPresenterPlayerId === playerId

  const handleUpdateStatement = (index: number, value: string) => {
    const newInputs = [...statementInputs]
    newInputs[index] = value
    setStatementInputs(newInputs)
  }

  const handleSubmitStatements = () => {
    if (selectedLieIndex === null || statementInputs.some(s => !s.trim())) {
      return
    }

    const statements = statementInputs.map((text, index) => ({
      text: text.trim(),
      isLie: index === selectedLieIndex
    }))

    submitStatements(statements)
    setHasSubmittedStatements(true)
  }

  const handleSubmitVote = (statementId: string) => {
    submitTwoTruthsVote(statementId)
    setSelectedVote(statementId)
    setHasSubmittedVote(true)
  }

  // Game completed view
  if (twoTruthsData.gamePhase === 'completed') {
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
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              🕵️
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              Two Truths and a Lie - Round {twoTruthsData.currentRound}
            </h1>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Badge variant="outline">
              Game: {gameState.code}
            </Badge>
            {twoTruthsData.gamePhase === 'waiting_for_statements' && (
              <Badge variant="secondary">
                {twoTruthsData.currentPresenterNickname}&apos;s turn
              </Badge>
            )}
          </div>
        </div>

        {/* Game Phase Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Statement Creation Phase */}
            {twoTruthsData.gamePhase === 'waiting_for_statements' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    {isCurrentPresenter ? 'Create Your Statements' : 'Waiting for Statements'}
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isCurrentPresenter 
                      ? 'Write 3 statements: 2 truths and 1 lie. Make them believable!'
                      : `${twoTruthsData.currentPresenterNickname} is writing their statements...`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isCurrentPresenter && !hasSubmittedStatements && timeLeft !== 0 ? (
                    <div className="space-y-4">
                      {statementInputs.map((statement, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Statement {index + 1}:</span>
                            <Button
                              variant={selectedLieIndex === index ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => setSelectedLieIndex(selectedLieIndex === index ? null : index)}
                            >
                              {selectedLieIndex === index ? "This is the LIE" : "Mark as lie"}
                            </Button>
                          </div>
                          <Textarea
                            value={statement}
                            onChange={(e) => handleUpdateStatement(index, e.target.value)}
                            placeholder={`Write statement ${index + 1}... (be creative but believable!)`}
                            maxLength={200}
                            rows={2}
                          />
                        </div>
                      ))}
                      
                      <Button 
                        onClick={handleSubmitStatements}
                        disabled={selectedLieIndex === null || statementInputs.some(s => !s.trim())}
                        className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Statements
                      </Button>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Tips:</strong> Make your lie believable! Mix in some details that could be true. 
                          The goal is to fool other players while keeping it fun.
                        </p>
                      </div>
                    </div>
                  ) : !isCurrentPresenter ? (
                    <div className="text-center py-8">
                      <div className="animate-pulse">
                        <PenTool className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-gray-600">Waiting for {twoTruthsData.currentPresenterNickname} to write their statements...</p>
                      </div>
                    </div>
                  ) : hasSubmittedStatements ? (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800">
                        ✅ Statements submitted! Other players will now vote on which one is the lie.
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
            {twoTruthsData.gamePhase === 'voting' && twoTruthsData.statements && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    Vote for the Lie
                    {timeLeft !== null && (
                      <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="ml-auto">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Which statement do you think is the lie? Choose carefully!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="font-medium text-lg">
                      {twoTruthsData.currentPresenterNickname}&apos;s Statements:
                    </p>
                  </div>

                  {!isCurrentPresenter && !hasSubmittedVote && timeLeft !== 0 ? (
                    <div className="space-y-3">
                      {twoTruthsData.statements.map((statement, index) => (
                        <div
                          key={statement.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedVote === statement.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300'
                          }`}
                          onClick={() => handleSubmitVote(statement.id)}
                        >
                          <div className="font-medium text-green-800 mb-1">
                            Statement {index + 1}
                          </div>
                          <p className="text-gray-700">{statement.text}</p>
                        </div>
                      ))}
                      <p className="text-sm text-gray-500 text-center">
                        Click on the statement you think is the lie!
                      </p>
                    </div>
                  ) : isCurrentPresenter ? (
                    <div className="space-y-3">
                      {twoTruthsData.statements.map((statement, index) => (
                        <div key={statement.id} className="p-4 rounded-lg border-2 border-gray-200">
                          <div className="font-medium text-green-800 mb-1">
                            Statement {index + 1}
                          </div>
                          <p className="text-gray-700">{statement.text}</p>
                        </div>
                      ))}
                      <Alert>
                        <AlertDescription>
                          You are presenting this round. Watch as others try to guess your lie!
                        </AlertDescription>
                      </Alert>
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
                        ⏰ Time&apos;s up! Revealing results...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results Display */}
            {twoTruthsData.gamePhase === 'revealing' && twoTruthsResults && (
              <Card>
                <CardHeader>
                  <CardTitle>Round {twoTruthsResults.round} Results</CardTitle>
                  <CardDescription>
                    See who guessed correctly and how points were awarded!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="font-medium text-lg">
                      {twoTruthsResults.presenterNickname}&apos;s Statements:
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {twoTruthsResults.statements.map((statement, index) => (
                      <div
                        key={statement.id}
                        className={`p-4 rounded-lg border-2 ${
                          statement.isLie 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-green-300 bg-green-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Statement {index + 1}</span>
                            {statement.isLie ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                LIE
                              </Badge>
                            ) : (
                              <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                TRUTH
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline">
                            {statement.votes} vote{statement.votes !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-gray-700">{statement.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Round Points:</h4>
                    {twoTruthsResults.scores
                      .sort((a, b) => b.roundPoints - a.roundPoints)
                      .map((score, index) => (
                      <div
                        key={score.playerId}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 && score.roundPoints > 0 ? 'bg-green-100 border-green-300' : 'bg-gray-50'
                        }`}
                      >
                        <span className="font-medium">{score.nickname}</span>
                        <Badge variant={index === 0 && score.roundPoints > 0 ? 'default' : 'secondary'}>
                          +{score.roundPoints} pts
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Scoring:</strong> Voters get 3 points for correctly identifying the lie. 
                      The presenter gets 2 points for each person they fooled.
                    </p>
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
                        player.id === playerId ? 'bg-green-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span className={player.id === playerId ? 'font-bold' : ''}>{player.nickname}</span>
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {player.id === twoTruthsData.currentPresenterPlayerId && (
                          <Badge variant="outline" className="text-xs">presenter</Badge>
                        )}
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
                  <span>{twoTruthsData.currentRound} / {gameState.settings.maxRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span>{gameState.players.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phase:</span>
                  <Badge variant="outline" className="text-xs">
                    {twoTruthsData.gamePhase.replace('_', ' ')}
                  </Badge>
                </div>
                {twoTruthsData.gamePhase === 'waiting_for_statements' && (
                  <div className="flex justify-between">
                    <span>Presenter:</span>
                    <span>{twoTruthsData.currentPresenterNickname}</span>
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