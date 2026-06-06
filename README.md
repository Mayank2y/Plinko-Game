# Plinko Lab - Provably Fair MERN Assignment

Interactive Plinko game built with the MERN stack: MongoDB/Mongoose, Express, React, and Node.js.

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

The React app runs on `http://localhost:5173` and proxies API calls to the Express server on `http://localhost:5000`.

Environment variables:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/plinko_lab
```

If `MONGO_URI` is not set, the server uses an in-memory store so the game can still be reviewed locally. For a true MERN run, start MongoDB and set `MONGO_URI`.

## Scripts

```bash
npm run dev      # React + Express together
npm run build    # production React build
npm start        # Express server serving dist/
npm test         # deterministic engine tests
```

## Architecture

- `frontend/`: React/Vite frontend with the Plinko board, controls, verifier page, recent rounds, CSV export, sound toggle, keyboard controls, tilt mode, and debug grid.
- `backend/server/`: Express API with Mongoose model and endpoints for commit, start, reveal, round lookup, recent rounds, and verification.
- `backend/shared/`: Fairness engine used by the backend and tests.
- `backend/tests/`: Node test runner checks for SHA-256, PRNG vectors, peg map prefix, and deterministic replay.

## Fairness Spec

The backend uses commit-reveal:

1. Server creates `serverSeed` and `nonce`.
2. Server publishes `commitHex = SHA256(serverSeed + ":" + nonce)`.
3. Player sends `clientSeed`, `betCents`, and `dropColumn`.
4. Server computes `combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)`.
5. xorshift32 is seeded from the first 4 bytes of `combinedSeed`, interpreted as big-endian.
6. The PRNG stream first creates the 12-row peg map, then makes the 12 row decisions.
7. Each peg has `leftBias = 0.5 + (rand() - 0.5) * 0.2`, rounded to 6 decimals.
8. `pegMapHash = SHA256(JSON.stringify(pegMap))`.
9. Drop column bias is `(dropColumn - floor(rows / 2)) * 0.01`.
10. At each row, the selected peg is `min(pos, row)`. If `rand() < adjustedBias`, move left; otherwise move right and increment `pos`.
11. Final `binIndex = pos`.

The `/verify` page and `GET /api/verify` endpoint recompute the commit, combined seed, peg map hash, path, and final bin from public inputs.

## API

- `POST /api/rounds/commit`
- `POST /api/rounds/:id/start`
- `POST /api/rounds/:id/reveal`
- `GET /api/rounds/:id`
- `GET /api/rounds?limit=20`
- `GET /api/verify?serverSeed&clientSeed&nonce&dropColumn&roundId=optional`

## Implemented Extras

- TILT mode: press `T`.
- Debug grid: press `G`.
- CSV download for recent rounds.
- Mute toggle, peg tick sound, landing sound.
- Keyboard controls: left/right arrows select the drop column, space drops.
- Reduced motion support via `prefers-reduced-motion`.

## AI Usage

AI was used to read the assignment PDF, scaffold the MERN project, implement the deterministic fairness engine, build the Express endpoints, create the React canvas board/verifier, and draft this README. The assignment test vector was kept as the source of truth for the hash, PRNG, and replay behavior.

## Time Log

- PDF reading and planning: ~20 minutes
- Fairness engine and tests: ~45 minutes
- API and data model: ~60 minutes
- React UI, animation, verifier, polish: ~2 hours
- Documentation and verification: ~30 minutes

## Next Steps

- Add a Mongo-backed integration test for the full commit/start/reveal lifecycle.
- Deploy frontend and API to Render/Fly/Vercel with MongoDB Atlas.
- Add fixed-timestep physics while keeping the deterministic engine authoritative.
