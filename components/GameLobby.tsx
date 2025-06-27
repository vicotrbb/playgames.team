'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSocket } from '@/lib/SocketContext'
import { Player } from '@/lib/SocketContext'
import { Copy, Crown, Users, Play, MessageSquare, Send } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GamePlay from './GamePlay'
import { DebugInfo } from './DebugInfo'

export default function GameLobby() {
  const [chatMessage, setChatMessage] = useState('')
  const [showChat, setShowChat] = useState(false)
  
  const { gameState, playerId, connected, startGame, leaveGame, sendChatMessage } = useSocket()

  console.log('🏛️ GameLobby render - gameState:', gameState, 'playerId:', playerId)

  if (!gameState || !playerId) {
    console.log('❌ GameLobby: Missing gameState or playerId, showing null')
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Loading lobby...</p>
            <p className="text-sm text-gray-500 mt-2">
              GameState: {gameState ? '✅' : '❌'} | PlayerId: {playerId ? '✅' : '❌'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If game is playing, show gameplay component
  if (gameState.status === 'playing') {
    return <GamePlay />
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId)
  const isHost = currentPlayer?.isHost || false
  const canStartGame = isHost && gameState.players.length >= 2
  
  const copyGameCode = async () => {
    try {
      await navigator.clipboard.writeText(gameState.code)
      // You could add a toast notification here
    } catch {
      // Fallback for browsers that don't support clipboard API
      console.log('Game code:', gameState.code)
    }
  }

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendChatMessage(chatMessage.trim())
      setChatMessage('')
    }
  }

  const handleStartGame = () => {
    startGame()
  }

  const handleLeaveGame = () => {
    leaveGame()
  }

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className={`w-8 h-8 bg-gradient-to-br ${
              gameState.gameType === 'guessio' 
                ? 'from-purple-500 to-pink-500' 
                : gameState.gameType === 'emojistory'
                ? 'from-blue-500 to-cyan-500'
                : 'from-green-500 to-teal-500'
            } rounded-lg flex items-center justify-center text-white text-sm font-bold`}>
              {gameState.gameType === 'guessio' ? '🎨' : gameState.gameType === 'emojistory' ? '📚' : '🕵️'}
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {gameState.gameType === 'guessio' ? 'Guessio' : gameState.gameType === 'emojistory' ? 'Emoji Story' : 'Two Truths and a Lie'} Lobby
            </h1>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {gameState.code}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyGameCode}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Share this code with friends to invite them!
          </p>
        </div>

        {/* Connection Status */}
        {!connected && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertDescription className="text-yellow-800 text-center">
              🔄 Connecting to server...
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Players List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({gameState.players.length}/{gameState.maxPlayers})
              </CardTitle>
              <CardDescription>
                Waiting for the host to start the game...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gameState.players.map((player: Player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      player.id === playerId ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${player.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="font-medium">{player.nickname}</span>
                      {player.isHost && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      {player.id === playerId && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Score: {player.score}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Game Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Game Settings</CardTitle>
              <CardDescription>
                Configure and start your {gameState.gameType === 'guessio' ? 'Guessio' : gameState.gameType === 'emojistory' ? 'Emoji Story' : 'Two Truths and a Lie'} game
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Max Rounds:</span>
                  <span>{gameState.settings.maxRounds}</span>
                </div>
                {gameState.gameType === 'guessio' && gameState.settings.guessingTimeLimit && (
                  <div className="flex justify-between text-sm">
                    <span>Guessing Time:</span>
                    <span>{gameState.settings.guessingTimeLimit}s</span>
                  </div>
                )}
                {gameState.gameType === 'emojistory' && gameState.settings.timePerTurn && (
                  <div className="flex justify-between text-sm">
                    <span>Time Per Turn:</span>
                    <span>{gameState.settings.timePerTurn}s</span>
                  </div>
                )}
                {gameState.gameType === 'twotruths' && gameState.settings.timePerTurn && (
                  <div className="flex justify-between text-sm">
                    <span>Time Per Round:</span>
                    <span>{gameState.settings.timePerTurn}s</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Game Status:</span>
                  <Badge variant={gameState.status === 'lobby' ? 'secondary' : 'default'}>
                    {gameState.status}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                {isHost ? (
                  <Button
                    onClick={handleStartGame}
                    disabled={!canStartGame}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {canStartGame ? 'Start Game' : `Need ${2 - gameState.players.length} more player(s)`}
                  </Button>
                ) : (
                  <div className="text-center text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
                    Waiting for {gameState.players.find(p => p.isHost)?.nickname} to start the game...
                  </div>
                )}

                <Button
                  onClick={handleLeaveGame}
                  variant="outline"
                  className="w-full"
                >
                  Leave Game
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Section (Optional) */}
        <Card>
          <CardHeader>
            <CardTitle 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="h-5 w-5" />
              Lobby Chat
              <Badge variant="secondary">{showChat ? 'Hide' : 'Show'}</Badge>
            </CardTitle>
          </CardHeader>
          {showChat && (
            <CardContent>
              <div className="space-y-4">
                <div className="h-32 bg-gray-50 rounded-lg p-3 overflow-y-auto">
                  <p className="text-sm text-gray-500 text-center">
                    Chat with other players while waiting...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage()
                      }
                    }}
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      <DebugInfo />
    </main>
  )
}