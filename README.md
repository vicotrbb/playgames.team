# 🎮 Playgames - Multiplayer Party Games

A real-time multiplayer gaming platform built with Next.js, featuring **Guessio** - an AI-powered party game where players guess prompts from AI-generated images.

## 🌟 Features

- **🤖 AI-Powered Gameplay** - Uses OpenAI DALL-E 3 for image generation and text embeddings for smart scoring
- **🔄 Real-time Multiplayer** - Up to 50 players per game with WebSocket communication
- **⚡ No Account Required** - Join with just a nickname, no signup needed
- **📱 Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **🔒 Privacy-First** - All game data automatically expires after 24 hours
- **⏱️ Fast-Paced Rounds** - 15-second guessing timer keeps games exciting
- **🏆 Smart Scoring** - AI calculates semantic similarity between guesses and prompts

## 🎯 How to Play Guessio

1. **Create or Join** a game with a 6-character code
2. **Wait in Lobby** for friends to join (2-50 players)
3. **Take Turns** being the prompter:
   - Prompter enters a text description
   - AI generates an image from that prompt
   - Other players have 15 seconds to guess the original prompt
4. **Get Scored** based on how close your guess is to the original
5. **Win** by having the highest total score after all rounds!

## 🚀 Tech Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful component library
- **Socket.IO Client** - Real-time communication

### Backend

- **Node.js/Express** - REST API server
- **Socket.IO** - WebSocket server for real-time events
- **Redis** - Ephemeral session storage with TTL
- **OpenAI API** - DALL-E 3 image generation & text embeddings

### Infrastructure

- **In-Memory Fallback** - Works without Redis for development
- **Session-based Auth** - Secure HTTP-only cookies
- **Error Boundaries** - Graceful error handling
- **Responsive Design** - Mobile-first approach

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (optional for development)
- Redis instance (optional - has in-memory fallback)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd playgames.team
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your values:

   ```env
   # Required for image generation (optional in development)
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # Optional - will use in-memory fallback if not provided
   REDIS_URL=redis://localhost:6379
   
   # Development settings
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NODE_ENV=development
   ```

4. **Start development servers**

   ```bash
   # Start both frontend and backend
   npm run dev:all
   
   # Or start them separately
   npm run dev      # Frontend on :3000
   npm run server   # Backend on :3001
   ```

5. **Open the application**
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:3001>

## 📁 Project Structure

```
playgames.team/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── GameLobby.tsx      # Lobby interface
│   ├── GamePlay.tsx       # Main gameplay interface
│   └── ErrorBoundary.tsx  # Error handling
├── lib/                   # Utility libraries
│   ├── socket.ts          # Socket.IO client hook
│   └── utils.ts           # Helper functions
├── server/                # Backend Express server
│   ├── handlers/          # WebSocket event handlers
│   ├── services/          # Business logic services
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Server entry point
├── documentation/         # Project documentation
└── public/               # Static assets
```

## 🎮 Game Flow Architecture

### Lobby Phase

1. **Game Creation** - Host creates game with unique 6-character code
2. **Player Joining** - Players join via game code and nickname
3. **Real-time Updates** - Live player list updates via WebSocket
4. **Game Start** - Host starts when ready (minimum 2 players)

### Gameplay Phase

1. **Prompt Submission** - Current prompter enters description
2. **AI Image Generation** - OpenAI DALL-E creates image asynchronously
3. **Guessing Phase** - 15-second timer, all players submit guesses
4. **AI Scoring** - Text embeddings calculate semantic similarity
5. **Results Display** - Show original prompt, all guesses, and scores
6. **Round Progression** - Auto-advance to next player as prompter

### Data Flow

```
Client ←→ WebSocket ←→ Express Server ←→ Redis ←→ OpenAI API
```

## 🔧 Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run server` - Start Express/Socket.IO server
- `npm run dev:all` - Start both servers concurrently
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🐛 Troubleshooting

### Common Issues

**"Connection refused" errors**

- Make sure both frontend (3000) and backend (3001) servers are running
- Check that no other applications are using these ports

**"OpenAI API not configured" warnings**

- Add your OpenAI API key to `.env.local`
- The app will use mock scoring without an API key

**Redis connection errors**

- Redis is optional - the app uses in-memory storage as fallback
- For production, set up Redis with `REDIS_URL` environment variable

**WebSocket connection issues**

- Ensure CORS is properly configured
- Check that `NEXT_PUBLIC_API_URL` points to the correct backend URL

## 🚢 Deployment

### Frontend (Vercel)

1. Deploy to Vercel with Next.js preset
2. Set environment variables in Vercel dashboard
3. Connect custom domain (optional)

### Backend (Railway/Heroku)

1. Deploy Express server to your preferred platform
2. Set environment variables including OpenAI API key
3. Configure Redis addon or external Redis service

### Environment Variables for Production

```env
OPENAI_API_KEY=sk-your-production-api-key
REDIS_URL=rediss://your-redis-url
NODE_ENV=production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **OpenAI** - For DALL-E 3 image generation and text embeddings
- **Vercel** - For Next.js and deployment platform
- **shadcn/ui** - For beautiful, accessible UI components
- **Socket.IO** - For real-time WebSocket communication

---

Built with ❤️ for bringing people together through games!
