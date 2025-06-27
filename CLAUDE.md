# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **playgames.team** - a fully implemented multiplayer gaming platform with **Guessio** as the first game. Guessio is a real-time party game for up to 50 players where one player enters a secret text prompt, AI generates an image from that prompt, and other players have 15 seconds to guess the original prompt. Scoring is based on semantic similarity using text embeddings.

## Development Commands

### Development
- `npm run dev` - Start Next.js frontend development server (port 3000)
- `npm run server` - Start Express/Socket.IO backend server (port 3001)  
- `npm run dev:all` - Start both frontend and backend concurrently
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint

### Production
- `npm run build` - Build Next.js frontend for production
- `npm run server:build` - Build backend TypeScript to JavaScript
- `npm run build:all` - Build both frontend and backend
- `npm run start` - Start production Next.js server
- `npm run server:start` - Start production backend server

### Docker
- `docker-compose up` - Start full stack with Redis using Docker
- `docker-compose up --build` - Rebuild and start containers

### Utilities
- `npm run clean` - Remove build artifacts (.next, dist)
- `npm test` - Run tests (currently placeholder)

## Architecture

The platform is implemented as a **monorepo** with:

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, and shadcn/ui components
- **Backend**: Node.js/Express server with Socket.IO for WebSocket communication
- **Database**: Redis for ephemeral session storage (24-hour TTL) with in-memory fallback
- **AI Integration**: OpenAI DALL-E 3 for image generation and text embeddings for scoring
- **Communication**: WebSocket-based real-time events with Redis Pub/Sub for scalability

## Key Architecture Components

### Frontend Structure
- **app/**: Next.js App Router pages and layouts
- **components/**: React components including GameLobby, GamePlay, and ui/ components
- **lib/**: Utilities including SocketContext for WebSocket management

### Backend Structure  
- **server/index.ts**: Express server with Socket.IO setup and REST API endpoints
- **server/services/**: Business logic (GameService, RedisService, OpenAIService)
- **server/handlers/**: WebSocket event handlers (SocketHandler)
- **server/types/**: TypeScript interfaces for Game, Player, GameRound

### Data Flow
- REST API for game creation/joining with HTTP-only cookie sessions
- WebSocket for real-time gameplay events
- Redis for persistent game state with automatic TTL cleanup
- OpenAI API calls server-side only for security

## Key Design Principles

- **Stateless & Ephemeral**: No user accounts required, all game data auto-expires after 24 hours
- **Session-based**: Players join using unique game codes/links with nicknames only
- **Real-time**: WebSocket communication for live multiplayer experience
- **Scalable**: Redis Pub/Sub enables horizontal scaling of WebSocket servers
- **Fault-tolerant**: In-memory fallback when Redis unavailable

## WebSocket Events

Key real-time events handled in server/handlers/SocketHandler.ts:
- `playerJoined`/`playerLeft` - Lobby updates
- `gameStarted` - Transition to gameplay
- `submitPrompt` - Prompt giver submits secret text
- `imageReady` - AI-generated image broadcast
- `submitGuess` - Players submit guesses
- `roundResults` - Scoring and results reveal
- `gameEnd` - Final scores and cleanup

## Development Environment

The application supports both Docker and local development:
- **Local**: Requires Node.js 18+, optional Redis and OpenAI API key
- **Docker**: Full stack including Redis via docker-compose
- **Environment**: Uses .env.local for configuration (see README.md)

## Testing

Currently uses placeholder test setup. When adding tests:
- Frontend: Consider React Testing Library with Jest
- Backend: Consider Jest for unit tests, Socket.IO testing for integration
- Use `npm run typecheck` to verify TypeScript correctness