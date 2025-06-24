# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **playgames.team** - a multiplayer gaming platform launching with its first game **Guessio**. Guessio is a real-time party game for up to 50 players where one player enters a secret text prompt, AI generates an image from that prompt, and other players have 15 seconds to guess the original prompt. Scoring is based on semantic similarity using text embeddings.

## Architecture

The platform is designed as a **monorepo** with:

- **Frontend**: Next.js with TypeScript, Tailwind CSS, and shadcn UI components
- **Backend**: Node.js/Express server with WebSocket support for real-time communication
- **Database**: Redis for ephemeral session storage (24-hour TTL)
- **AI Integration**: OpenAI GPT-Image-1 for image generation and text embeddings for scoring
- **Communication**: WebSocket-based real-time events with Redis Pub/Sub for scalability

## Key Design Principles

- **Stateless & Ephemeral**: No user accounts required, all game data auto-expires after 24 hours
- **Session-based**: Players join using unique game codes/links with nicknames only
- **Real-time**: WebSocket communication for live multiplayer experience
- **Scalable**: Redis Pub/Sub enables horizontal scaling of WebSocket servers

## Game Flow

1. **Lobby Phase**: Players create/join games with unique codes, host starts game
2. **Round Sequence**: Rotating prompt giver → AI image generation → 15s guessing → scoring
3. **Scoring**: Cosine similarity between guess embeddings and prompt embeddings (0-10 points)
4. **Multi-round**: Continue until all players have given prompts or fixed rounds complete

## Implementation Phases

Based on the implementation plan in `documentation/implementation_plan.md`:

1. **Phase 1**: Foundational setup (Next.js, Express, WebSocket, Redis, OpenAI config)
2. **Phase 2**: Lobby development (create/join games, player management)
3. **Phase 3**: Gameplay engine (prompt submission, image generation, guessing)
4. **Phase 4**: Scoring logic (embeddings, similarity calculation, results)
5. **Phase 5**: Polish, testing, and deployment

## Data Storage

- **Redis Keys**: `game:{code}` for game state, `game:{code}:guesses` for round data
- **TTL**: All keys expire after 24 hours automatically
- **Player Data**: Only ephemeral session IDs and nicknames stored
- **Cleanup**: Explicit deletion on game end + TTL as backup

## WebSocket Events

Key real-time events include:
- `playerJoined`/`playerLeft` - Lobby updates
- `gameStart` - Transition to gameplay
- `submitPrompt` - Prompt giver submits secret text
- `imageReady` - AI-generated image broadcast
- `submitGuess` - Players submit guesses
- `roundEnd` - Scoring and results reveal
- `gameEnd` - Final scores and cleanup

## Development Notes

This is currently a **planning stage repository** with documentation only. The actual implementation will follow the detailed plan in `documentation/implementation_plan.md` and product requirements in `documentation/prd.md`.

When implementing:
- Use Redis for all transient state management
- Implement proper WebSocket error handling and reconnection
- Ensure OpenAI API calls are server-side only
- Test with multiple concurrent players (up to 50 per game)
- Verify TTL-based cleanup works correctly