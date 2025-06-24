import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'

import { GameService } from './services/GameService'
import { RedisService } from './services/RedisService'
import { OpenAIService } from './services/OpenAIService'
import { SocketHandler } from './handlers/SocketHandler'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
})

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// Services
const redisService = new RedisService()
const openaiService = new OpenAIService()
const gameService = new GameService(redisService, openaiService)
const socketHandler = new SocketHandler(io, gameService)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Game API endpoints
app.post('/api/create-game', async (req, res) => {
  try {
    const { hostNickname } = req.body
    
    if (!hostNickname || hostNickname.trim().length === 0) {
      return res.status(400).json({ error: 'Host nickname is required' })
    }

    const gameCode = generateGameCode()
    const hostId = uuidv4()
    
    const game = await gameService.createGame(gameCode, hostId, hostNickname.trim())
    
    // Set session cookie for the host
    res.cookie('sessionId', hostId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })
    
    res.json({
      gameCode,
      hostId,
      game: {
        code: game.code,
        players: game.players,
        status: game.status
      }
    })
  } catch (error) {
    console.error('Error creating game:', error)
    res.status(500).json({ error: 'Failed to create game' })
  }
})

app.post('/api/join-game', async (req, res) => {
  try {
    const { gameCode, nickname } = req.body
    
    if (!gameCode || !nickname) {
      return res.status(400).json({ error: 'Game code and nickname are required' })
    }

    // Check if player already has a session
    let playerId = req.cookies.sessionId
    if (!playerId) {
      playerId = uuidv4()
    }

    const result = await gameService.joinGame(gameCode.toUpperCase(), playerId, nickname.trim())
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Set session cookie
    res.cookie('sessionId', playerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })
    
    res.json({
      playerId,
      game: result.game
    })
  } catch (error) {
    console.error('Error joining game:', error)
    res.status(500).json({ error: 'Failed to join game' })
  }
})

app.get('/api/game/:gameCode', async (req, res) => {
  try {
    const { gameCode } = req.params
    const game = await gameService.getGame(gameCode.toUpperCase())
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    res.json({ game })
  } catch (error) {
    console.error('Error getting game:', error)
    res.status(500).json({ error: 'Failed to get game' })
  }
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  socketHandler.handleConnection(socket)
})

// Generate a 6-character alphanumeric game code
function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Start server
const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Game server running on port ${PORT}`)
  console.log(`📡 WebSocket server ready for connections`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

export { app, server, io }