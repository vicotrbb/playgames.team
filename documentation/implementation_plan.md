# Implementation Plan for the Playgames "Guessio" Platform

## Phase 1: Foundational Setup

* **Frontend (Next.js + Tailwind + Shadcn UI):** Initialize a Next.js project with TypeScript. Install and configure Tailwind CSS for styling. Integrate the Shadcn UI component library (Radix-based components) for a consistent design system. Set up a basic layout and theme, verifying that Tailwind and Shadcn styles work correctly in a sample page.

* **Backend (Node.js/Express API Server):** Set up a lightweight Express server in the same repository (monorepo or separate folder) with TypeScript support. Configure the server to run alongside the Next.js app (e.g. with `concurrently` in development). Create a basic health-check endpoint to verify the server runs. Plan the server structure (e.g. routes or controllers for game logic, though primary communication will be via WebSockets).

* **WebSocket Integration:** Choose a WebSocket library (e.g. **Socket.IO** for convenience or the native WebSocket API). Initialize WebSocket handling on the Express server. Implement a simple connection handler that logs when a client connects or disconnects. Enable CORS as needed so the Next.js frontend can connect to the WebSocket. This will lay the groundwork for real-time game events.

* **Redis Setup (Upstash):** Create an Upstash Redis instance for ephemeral data storage. Obtain the Redis connection URL/credentials and add them to the server’s environment config. Install a Redis client library (e.g. `ioredis` or Upstash SDK) and verify connectivity by performing a test read/write on server startup. Plan to use Redis for game state storage and Pub/Sub messaging (for scalability). Ensure to use TLS (`rediss://`) for secure Redis communication if required.

* **Session-Based Auth (Stateless):** Implement a session mechanism that doesn’t require user accounts or persistent login. For example, generate a unique **session ID** (e.g. UUID) for each new client connection or browser session and store it in a cookie. This will serve as an **ephemeral user ID** to identify players without formal accounts. No server-side session store is needed – the app can remain stateless by trusting this client-provided token for identification. Configure the Express server to use a lightweight cookie parser or simply handle the session ID manually via query parameters or headers during WebSocket connection. (The key idea is to allow users to play *without logging in*, improving adoption by removing sign-up friction.)

* **OpenAI API Config:** Set up environment variables for the OpenAI API key (needed for GPT-Image-1 and embeddings). On the backend, install OpenAI’s Node SDK or prepare to use `fetch/axios` for HTTP calls to the OpenAI endpoints. No actual API call is made yet – just ensure the key is loaded and the SDK/client is initialized properly for later use.

## Phase 2: Game Lobby Development

* **Frontend – Lobby UI:** Create a lobby interface where players can create or join a game session. This includes:

  * A "Create Game" button that starts a new game lobby (and generates a unique game code or link).
  * An input field to join an existing game by entering a game code.
  * A prompt for the player to enter a display name (since no login, allow them to pick a nickname for the session).
  * The lobby screen showing a list of players who have joined and a status (e.g. “Waiting for host to start the game”). Use Shadcn UI components for form inputs, buttons, and list display for players for a polished look.
  * If the current player is the host (game creator), show a "Start Game" button to launch the game when ready.

* **Backend – Lobby Endpoints/Logic:** Implement API routes or WebSocket event handlers for lobby actions:

  * **Create Game:** When a request or event to create a game comes in, generate a unique game ID or invite code (could be a short random string). Initialize a game state in Redis under a key like `game:{code}`. Store initial info: game code, empty player list, status = “waiting”. Set an expiry (TTL) of 24 hours on this key so it auto-deletes after 24 hours (to enforce ephemeral game data).
  * **Join Game:** When a player enters a game code, handle via WebSocket event or an HTTP API that validates the code (checks Redis if the game exists and is in waiting state). On success, add the player to the game’s player list in Redis. Store their nickname and a generated player ID (perhaps use the session ID as player ID). If using session cookies, associate the session ID with this game in a Redis set for that game’s players.
  * **Leave Game:** (Optional) Handle if a player disconnects in the lobby or leaves before start – remove them from the Redis player list and broadcast the update.

* **WebSocket – Lobby Events:** Use WebSocket to broadcast real-time updates in the lobby:

  * When a new player joins, broadcast an event (e.g. `playerJoined`) with the updated player list or the new player info to all clients in that lobby so the UI can update the player list immediately.
  * When a player leaves or disconnects, broadcast a `playerLeft` event to update the list.
  * When the host clicks "Start Game", emit a `gameStart` event to all players, which will transition clients from the lobby UI to the gameplay UI.

* **Redis – Lobby State Management:** Use Redis to manage the lobby state:

  * Maintain a hash or similar structure for game metadata (game status, round number, host ID, etc.).
  * Maintain a list/set of players in the game (to easily broadcast events to all via stored session IDs if needed, or just for state tracking).
  * Each player can be stored as a small object (id, name). As Redis is the single source of truth for game state, the backend server can always rebuild the current lobby state from Redis (making the system stateless and scalable, since any server instance can handle requests by reading Redis).
  * Ensure all writes to Redis for game state include an expiration of 24 hours on the keys (or set a TTL on game creation) to satisfy auto-deletion of stale games.

* **Session Handling in Lobby:** When a player joins, if they don’t already have the session ID cookie, generate one (this was set up in Phase 1). Use this ID to track the player in Redis. For example, use `player:{sessionId}` as a key to store their current game or use it as the player’s unique ID in the game’s player list. This avoids duplicate entries if the user reconnects. No personal data is stored – just an ephemeral identifier.

* **Validation & Edge Cases:** Add validation checks:

  * Prevent joining a non-existent or already-started game (return an error or emit a failure event).
  * Limit the number of players to 50 (if a 51st join is attempted, reject it).
  * If the host leaves the lobby before starting, designate another player as host or prevent game start until a host is present (simplest approach: treat the first player in list as host).
  * Ensure that the same session ID can’t join the same game twice concurrently (handle page refresh or duplicate tabs by recognizing the session and avoiding duplicate players).

## Phase 3: Gameplay Engine (Prompt Submission & Guessing)

* **Frontend – Gameplay UI:** Build the main game interface for the active round:

  * Display the game image (once generated) in the center of the screen (with a loading indicator before the image is ready).
  * If the current user is the **prompt setter** (the one entering the prompt this round), show them an input box to enter the prompt description *secretly*. This prompt input should only be visible to the prompter and not to other players.
  * For **guessers** (all other players), show a waiting message while the image is being generated, then show the generated image and a text input for submitting their guess of what the prompt was. Include a submit button for guesses.
  * Show a list or counter of how many players have submitted their guess (without revealing guesses yet). This gives an idea of progress.
  * Possibly include a round timer or at least indicate to players to submit guesses within a time limit (if desired for game pacing).
  * UI elements for after guesses: maybe a “Reveal/Score” button or automatic transition to the scoring phase once all guesses are in or time is up.

* **Round Flow Control:** Determine how rounds start and proceed:

  * Decide how the **prompt setter** is chosen: e.g. the host could be the first prompter, then subsequent rounds rotate through players. Implement logic to select a player as the prompter for the round and inform everyone who it is (except perhaps not explicitly, though players might figure out who isn’t guessing).
  * When the host clicks "Start Game" (or "Next Round"), the server should pick the prompter for the round and send an event (`startRound`) to all clients indicating the round has begun and who the prompter is (or at least to the prompter privately, instructing them to submit a prompt).

* **Backend – Prompt Submission:** Handle the prompt input from the prompter:

  * When the prompter submits a text prompt (via a WebSocket event like `submitPrompt`), the server receives it. Immediately, store the prompt text in Redis (under the game state, e.g. `game:{code}:currentPrompt`) and possibly also store which player is the prompter for this round.
  * **OpenAI Image Generation:** Call the OpenAI GPT-Image-1 API to generate an image from the prompt. This involves sending the prompt text to OpenAI’s image generation endpoint. Handle this asynchronously, as the API may have latency (possibly a few seconds). While waiting for the image:

    * Optionally send a temporary update to clients that image generation is in progress (so the UI can show a loading spinner).
    * Ensure to handle the case of a slow API call – if it’s extremely slow or times out, consider retrying or sending an error message to the game.
  * Once the image is generated, retrieve the image URL or binary. (OpenAI’s API likely returns a URL to the generated image or a base64 data; the Node SDK or HTTP call will provide this.)
  * Store the image (for example, temporarily in memory or Redis – perhaps just store the URL in Redis as part of game state).
  * Emit a WebSocket event `imageReady` to all players in the game with the image URL (or some identifier to fetch it). All clients will then display this image in their UI. The prompter’s prompt text is **not** sent to others at this time.

* **Backend – Guess Submission:** Once the image is broadcast:

  * Listen for guess submissions from players via a `submitGuess` WebSocket event. Each guess event includes the player’s ID and their guess text.
  * Upon receiving a guess, store it in Redis under a list for the current round (e.g. `game:{code}:guesses` as a list of `{playerId: guess}` entries). This allows collecting all guesses for scoring.
  * (Optionally, immediately acknowledge to the guesser that their guess was received, perhaps by a brief UI confirmation. But do not reveal any correctness yet.)
  * Broadcast to all players (or update a counter) that one more guess has been received (without revealing the guess content). For example, increment a “guess count” that all players can see, or list the player who have already guessed.
  * If there is a maximum of one guess per player, enforce that by ignoring further guesses from the same player in the round.

* **Managing Round Completion:** Decide how the round ends:

  * If all players (except the prompter) have submitted a guess, the round can end automatically. Or, set a timer (like 60 seconds) from the time the image is shown, after which no more guesses are accepted.
  * Implement the logic to determine end-of-round: e.g. if number of guesses == number of guessers, or a timer event triggers the end.
  * When round ends, trigger the scoring phase (either automatically or via a “Reveal Scores” action by the host). This can be done by emitting a `roundEnd` or `computeScores` event to the server, which then proceeds to scoring logic (Phase 4).

* **WebSocket – Gameplay Events:** Real-time events to implement:

  * `startRound`: informs the prompter to provide a prompt and others to wait.
  * `imageReady`: sends out the generated image to everyone.
  * `guessSubmitted` (or a less noisy aggregate, like `guessCountUpdate`): lets clients know a new guess was submitted (to update any UI counters).
  * `roundEnd`: signals clients that guess submission is closed and scoring is about to happen (clients might then disable guess inputs).
  * These events ensure all clients stay in sync about the round’s state in real time.

* **Redis – Round Data:** Use Redis to keep transient round data:

  * Store the current round’s prompt, image URL, prompter ID, etc., under the game key.
  * Store each guess as it comes in. Redis could use a list or hash (e.g. `game:{code}:guesses` list of guess texts, or a hash mapping playerID -> guess).
  * This data can have a very short TTL or be cleaned up right after the round’s scores are computed (since each round’s data is only needed briefly). Alternatively, keep it until game end for reference or to show a history of rounds.
  * Use Redis Pub/Sub if you plan to have multiple server instances: each guess or event could be published to a channel that all instances subscribe to, so that any instance can handle broadcasting to its connected clients (this is particularly relevant if scaling horizontally; Redis Pub/Sub helps synchronize state updates across servers).

## Phase 4: Scoring Logic and Results

* **Backend – Embedding & Similarity Scoring:** Implement the scoring mechanism using text embeddings:

  * When a round ends, the server will take the prompt text (the correct answer) and each player’s guess text and obtain vector embeddings for each. Use OpenAI’s embedding API (e.g. *text-embedding-ada-002* model) to encode the prompt and all guesses into embedding vectors.
  * Compute the **cosine similarity** between each guess’s embedding and the prompt’s embedding. Cosine similarity effectively measures semantic closeness by the angle between vectors in the embedding space. The result will be a score (typically between -1 and 1, but since these are likely normalized positive embeddings, scores will be 0 to 1 where 1 is most similar).
  * Determine the scoring rules using these similarities. For example, you can sort the guesses by similarity and award points: the highest similarity guess gets, say, 3 points, second highest 2 points, etc., or alternatively give a point to any guess above a certain similarity threshold. Define a fair scoring system (this can be adjusted with play-testing).
  * In addition, consider giving the prompter some points if at least one person guessed closely (to incentivize good prompts), or other game-specific scoring rules as desired.

* **Backend – Reveal Results:** Prepare the results data to send to players:

  * Identify which guess was the closest (highest similarity) and perhaps mark if it’s an exact match (if you decide an exact match means 100% similarity or if you treat exact string match specially).
  * Create a scoreboard update: a list of players and the points they earned this round (and possibly their total points if multiple rounds).
  * Also include the actual prompt (correct answer) to reveal to everyone after guessing is closed.
  * Write these results into Redis (e.g. update a sorted set of total scores for the game, or just a hash of player -> total score).
  * If doing multiple rounds, maintain the cumulative scores in Redis so they persist through the game.

* **WebSocket – Broadcast Scores:** Emit a `roundResults` event to all clients with the round’s outcome:

  * Include the full prompt (so everyone sees what the correct prompt was).
  * List each player’s guess and a score or correctness indicator for each (this is optional to show all guesses; it can be fun for players to see all guess attempts and how close they were).
  * Provide the points awarded to each player and their new total score.
  * The clients will use this to render the results screen for the round.

* **Frontend – Results Display:** Build a results UI that appears after each round:

  * Show the correct prompt text alongside the image (so players connect the answer to the image).
  * Display a list of guesses from all players with perhaps a similarity percentage or relative indication (e.g. “Very close”, “Close”, “Not close” depending on the score).
  * Highlight the best guess (e.g. “Winner of this round: Player X with guess ‘\_\_\_\_\_’”).
  * Show updated scores for all players (a leaderboard).
  * Acknowledge the prompt setter as well (maybe “Prompt by Player Y”). You can also display if the prompt setter gets points.
  * Provide a “Next Round” button for the host (or automatically proceed after a short delay) to start the next round if there will be multiple rounds.

* **Multi-Round Flow:** If the game consists of multiple rounds (e.g. each player gets to be the prompter once, or a fixed number of rounds):

  * After displaying results, reset the round-specific state in Redis (clear the guesses list, etc.) but keep the overall game state and scores.
  * Select the next prompter (e.g. the next player in the list who hasn’t given a prompt yet).
  * Use the `Next Round` action to trigger another `startRound` event with the new prompter, and repeat the prompt -> image -> guess -> score cycle.
  * If it was the final round (all players have done a prompt or a predefined number of rounds reached), then proceed to game end.

* **Game End and Cleanup:** Determine the end-of-game condition:

  * After the last round, emit a `gameEnd` event with final results (final leaderboard highlighting the winner(s)). The frontend can show a “Game Over” screen with the winner.
  * Clean up game data: delete the Redis keys for that game or let them expire soon. You might explicitly call a Redis `DEL` on the game state now to free memory (since the game is over), or let the TTL handle it eventually. Ensure that no further events are processed for that game code after completion.
  * Inform clients that the session is over; optionally provide a way to restart or play again with a new game.

## Phase 5: Final Polish, Testing, and Deployment

* **Frontend UI/UX Enhancements:** Refine the UI using Tailwind and Shadcn components for a professional finish:

  * Make sure the lobby and game screens are responsive (usable on desktop and mobile, given many players might use phones).
  * Add visual cues and animations: e.g. a loading spinner or shimmer effect while waiting for image generation, a countdown timer bar for guess phase, highlight the winning guess with a trophy icon, etc.
  * Use color and typography consistently (perhaps configure Tailwind theme or use Shadcn’s theming) to make the game visually appealing.
  * Add any helpful tooltips or instructions on the UI so new players know what to do (for example, a brief “How to Play Guessio” on the lobby screen or a modal with rules).

* **Robust Error Handling:** Audit the app for potential failure points and handle them gracefully:

  * If the OpenAI image API call fails or exceeds a time threshold, notify the players that image generation failed and allow the prompter to try a new prompt or retry. Don’t leave the game hanging.
  * If the OpenAI embedding API fails during scoring, have a fallback (maybe retry once, or in worst case, skip scoring and just reveal the prompt without scores, with an apology message).
  * Handle WebSocket connection issues: if a player disconnects mid-game and reconnects, allow them to re-sync with the current state (since state is in Redis, a reconnecting client can be given the latest game state – implement a method to fetch current state on reconnect).
  * Validate inputs on the server side: e.g. prompt and guess lengths (perhaps limit to a reasonable length to avoid absurdly long text), and ensure no malicious content (the OpenAI API already does some moderation on image prompts, but you might also use OpenAI’s moderation API on text if needed).
  * Use try/catch around asynchronous calls (OpenAI, Redis) and emit error events to clients if needed so that the UI can display an error or take recovery actions.

* **Security & Privacy:** Although the app is stateless and has no user accounts, ensure basic security:

  * Use HTTPS for all client-server communication (especially WebSockets and API calls).
  * Do not expose the OpenAI API key to clients – all calls should be made from the server side.
  * Implement server-side rate limiting or quotas if necessary (to prevent abuse of the OpenAI API through your game, since image generation and embeddings cost money or have rate limits).
  * The session IDs used should be sufficiently random to not guess; they only identify players in the context of a game and carry no personal info.
  * Clear any sensitive data – though mainly there is none (prompt and guesses could be considered user-generated content; you store them short-term and then remove).

* **Performance & Scalability:** Ensure the application can handle up to 50 concurrent players per game and possibly multiple games at once:

  * Optimize the image generation flow: consider starting the OpenAI image API call as soon as the prompt is received and perhaps do embeddings in parallel after receiving guesses to reduce wait time. Monitor the latency of these calls (OpenAI image generation could take several seconds).
  * Use Redis Pub/Sub with the WebSocket server if deploying multiple server instances. For example, if using Socket.IO, integrate the **Redis adapter** so that messages (events) are broadcast across all nodes via Redis Pub/Sub. This way, any client can connect to any server instance and still receive all game events, keeping the system stateless and horizontally scalable.
  * Verify that Redis commands used are efficient (e.g. use pipelining or multi-get where appropriate, especially for fetching all guesses for scoring at once).
  * Limit the size of data stored in Redis (only store what's necessary: for instance, the images themselves might not need storing if you directly send URL to clients).
  * Test with a high number of dummy players (simulate 50 WebSocket connections) to see performance. Upstash Redis has throughput limits; ensure those are not exceeded or use a plan that can handle the message volume.

* **Testing (Phase-wise and Integration):** Conduct thorough testing at each phase:

  * Write unit tests or integration tests for critical backend logic (e.g. scoring function given some dummy embeddings, or game state functions for adding/removing players).
  * Manually test the lobby flow: creating a game, joining from multiple browsers, ensuring the player list updates correctly.
  * Test the image generation and guessing flow with 2-3 players to ensure timing works (maybe throttle your OpenAI call to simulate slowness).
  * Test weird cases: only one player in game (should the game even start?), maximum players, players disconnecting mid-round, etc.
  * Ensure the 24-hour TTL in Redis works (simulate by manually expiring a key).
  * If possible, do a load test with multiple parallel games and multiple players to see if any race conditions or scaling issues arise.

* **Deployment:** Prepare for deployment in a production environment:

  * Containerize the app or use a platform that supports both Next.js and a Node backend. One approach is deploying the Next.js frontend on Vercel and the Node/Express WebSocket server on a service like Fly.io, Heroku, or AWS (since Vercel’s serverless functions may not keep persistent WebSocket connections easily). Ensure the WebSocket server’s URL is configured in the client.
  * Set environment variables in production for the OpenAI API key and Upstash Redis URL. Double-check that these secrets are not exposed.
  * Enable logging/monitoring on the server – capture errors and important events to logs (e.g. use a logging library, and connect to a monitoring service or even just CloudWatch/papertrail).
  * Use a custom domain or the provided domain for the frontend (e.g. playgames.team) and ensure CORS and socket connections are allowed from that domain to the backend.
  * Verify that when deployed, the WebSocket handshake (perhaps Socket.IO upgrade) works over wss (secure WebSocket).

* **Final Game Polish:** Add any finishing touches to improve game enjoyment:

  * Sound effects on certain events (e.g. a sound when the image appears, or a drumroll when revealing the winner).
  * Display the remaining time for guessing if using a timer.
  * Prevent cheating: for example, ensure that the prompter’s prompt text is never sent to clients until reveal (only the image is sent) – double-check this security.
  * Possibly integrate a shareable link for the game lobby so players can invite others easily (e.g. `playgames.team/game/ABC123` to join game code ABC123).
  * Provide a graceful game termination if the host decides to cancel the game or if everyone leaves.
  * Clean up any UI issues, and ensure the app is accessible (use alt text for images, proper ARIA labels for screen readers, etc., as time permits).

* **Launch and Monitor:** Once deployed, do a final round of testing in the live environment with a few users. Monitor the Redis usage and OpenAI API usage. Collect feedback from initial players to identify any rough edges. Since the architecture is stateless and uses scalable components (WebSockets + Redis pub/sub) it should handle additional load by adding more server instances if needed. Keep an eye on logs for any runtime errors and fix them promptly. With that, *Guessio* on Playgames is ready for players, with a robust, scalable implementation!&#x20;
