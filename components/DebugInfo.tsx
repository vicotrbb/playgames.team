'use client'

import { useSocket } from '@/lib/SocketContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DebugInfo() {
  const { socket, connected, gameState, playerId, error } = useSocket()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-96 overflow-auto">
      <CardHeader>
        <CardTitle className="text-sm">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <strong>Socket:</strong> {socket ? '✅' : '❌'}
        </div>
        <div>
          <strong>Connected:</strong> {connected ? '✅' : '❌'}
        </div>
        <div>
          <strong>Player ID:</strong> {playerId || 'None'}
        </div>
        <div>
          <strong>Game State:</strong> {gameState ? '✅' : '❌'}
        </div>
        {gameState && (
          <div>
            <strong>Game Code:</strong> {gameState.code}
          </div>
        )}
        {gameState && (
          <div>
            <strong>Players:</strong> {gameState.players.length}
          </div>
        )}
        {error && (
          <div className="text-red-600">
            <strong>Error:</strong> {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}