'use client'

import { useSocket } from '@/lib/SocketContext'
import GuessioGamePlay from './GuessioGamePlay'
import EmojiStoryGamePlay from './EmojiStoryGamePlay'
import TwoTruthsGamePlay from './TwoTruthsGamePlay'

export default function GamePlay() {
  const { gameState } = useSocket()

  if (!gameState) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <div>Loading game...</div>
      </div>
    )
  }

  // Route to the appropriate game component based on game type
  if (gameState.gameType === 'guessio') {
    return <GuessioGamePlay />
  } else if (gameState.gameType === 'emojistory') {
    return <EmojiStoryGamePlay />
  } else if (gameState.gameType === 'twotruths') {
    return <TwoTruthsGamePlay />
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
      <div>Unknown game type: {gameState.gameType}</div>
    </div>
  )
}