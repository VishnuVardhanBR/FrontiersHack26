# QuizCraft: Doc-to-Minecraft Historical Learning Agent

## Aqua Roma demo (branch: `feature/aqua-roma-hardcoded`)

Hardcoded 3–5 minute vertical slice: Roman aqueduct guided tour + one simple puzzle. No procedural generation.

- **Spec and checklists:** `docs/AQUA_ROMA_SPEC.md`
- **Experience package (shared):** `packages/shared/src/plans/aqua-roma-experience.ts` — export `AQUA_ROMA_EXPERIENCE`
- **Build plan (bot):** `packages/bot/src/plans/aqua-roma-build.ts` — export `AQUA_ROMA_BUILD_PLAN`

To run the demo, wire a “demo mode” that loads these plans instead of calling the experience planner and scene builder (e.g. create session with this experience and build plan pre-set).

---

## Context

Build a system that converts teacher-uploaded historical chapters into immersive Minecraft learning experiences. A student joins a locally hosted Minecraft world and is guided by a bot companion through a historically-inspired scene with narration, questions, and exploration objectives. Target: middle school learners, 5-7 minute sessions.

**Design doc**: `/Users/vishnuvardhan/Downloads/Design Document.md`
**Reference project** (patterns only): `/Users/vishnuvardhan/Code/frontiers/minecraftlm`

## Decisions

| Decision | Choice |
|----------|--------|
| Language | Node.js / TypeScript (monorepo) |
| LLM | Gemini 3 Flash (`gemini-3-flash-preview`) via `@google/generative-ai` |
| API Key | `GEMINI_API_KEY` in `.env` (gitignored) |
| Frontend | React + Vite (controls only, no 3D viewer) |
| MC Version | 1.21.1 |
| MC Server | User's jar at `/Users/vishnuvardhan/Downloads/server.jar` — copy into project |
| Build method | `/setblock` + `/fill` via `bot.chat()` (bot has OP) |
| Game mode | Creative (bot), Adventure (student) |
| RAG | Skip for MVP — pass full chapter text to LLM |
| State machine | Custom lightweight FSM (not mineflayer-statemachine package) |

---

## Directory Structure

```
quizcraft/
├── package.json                    # npm workspaces root
├── tsconfig.base.json              # Shared TS config
├── .env                            # GEMINI_API_KEY (gitignored)
├── .env.example
├── .gitignore
├── run.sh                          # Launches MC server + backend + frontend
│
├── packages/
│   ├── shared/                     # @quizcraft/shared — Zod schemas, types, constants
│   │   └── src/
│   │       ├── schemas/
│   │       │   ├── experience-package.ts
│   │       │   ├── build-plan.ts
│   │       │   ├── session-state.ts
│   │       │   └── sse-events.ts
│   │       ├── types/
│   │       │   └── minecraft.ts
│   │       └── constants/
│   │           ├── blocks.ts       # Block palette constants
│   │           └── limits.ts       # World limits (100x100x100)
│   │
│   ├── server/                     # @quizcraft/server — Express API
│   │   └── src/
│   │       ├── index.ts            # Express app entry
│   │       ├── config.ts           # Env vars
│   │       ├── routes/
│   │       │   ├── upload.ts       # POST /api/upload
│   │       │   ├── session.ts      # GET /api/sessions/:id
│   │       │   └── stream.ts       # GET /api/sessions/:id/stream (SSE)
│   │       ├── services/
│   │       │   ├── experience-planner.service.ts   # Model 1: Gemini call
│   │       │   ├── session.service.ts              # Session CRUD (file-based)
│   │       │   ├── bot-bridge.service.ts           # Server <-> Bot EventEmitter
│   │       │   └── event-buffer.ts                 # SSE buffer
│   │       └── gemini/
│   │           ├── client.ts       # Gemini API wrapper
│   │           └── prompts/
│   │               ├── experience-planner.txt
│   │               └── scene-builder.txt
│   │
│   ├── bot/                        # @quizcraft/bot — Mineflayer runtime
│   │   └── src/
│   │       ├── index.ts            # Bot process entry
│   │       ├── bot-manager.ts      # Mineflayer instance lifecycle
│   │       ├── fsm/
│   │       │   ├── tutor-fsm.ts    # FSM controller (tick loop + chat routing)
│   │       │   ├── states/         # One file per state
│   │       │   │   ├── idle.state.ts
│   │       │   │   ├── build-scene.state.ts
│   │       │   │   ├── wait-for-player.state.ts
│   │       │   │   ├── introduce.state.ts
│   │       │   │   ├── escort-to-region.state.ts
│   │       │   │   ├── narrate.state.ts
│   │       │   │   ├── ask-question.state.ts
│   │       │   │   ├── evaluate-answer.state.ts
│   │       │   │   ├── monitor-objective.state.ts
│   │       │   │   ├── climax-recap.state.ts
│   │       │   │   └── end-session.state.ts
│   │       │   └── transitions.ts
│   │       ├── builder/
│   │       │   ├── scene-builder.ts       # Orchestrates Model 2 + templates + execution
│   │       │   ├── block-placer.ts        # /setblock + /fill command execution
│   │       │   ├── templates/
│   │       │   │   ├── structures.ts      # Prefab templates (house, wall, path, arch, etc.)
│   │       │   │   ├── terrain.ts         # Terrain helpers
│   │       │   │   └── decorations.ts     # Signs, torches, props
│   │       │   └── walkability-checker.ts # Pathfinder-based route verification
│   │       ├── tutor/
│   │       │   ├── narrator.ts            # Chat narration (splits long messages)
│   │       │   ├── question-asker.ts
│   │       │   ├── answer-evaluator.ts    # Keyword/concept fuzzy matching
│   │       │   └── hint-manager.ts        # Progressive hints
│   │       ├── navigation/
│   │       │   ├── escort.ts              # Pathfinder escort logic
│   │       │   ├── trigger-monitor.ts     # Coordinate-radius trigger checking
│   │       │   └── player-tracker.ts      # Track player position
│   │       └── assessment/
│   │           ├── session-tracker.ts
│   │           └── summary-generator.ts
│   │
│   └── frontend/                   # @quizcraft/frontend — React + Vite
│       └── src/
│           ├── main.tsx
│           ├── App.tsx             # Router: / and /session/:id
│           ├── components/
│           │   ├── UploadPage.tsx   # File upload + teacher settings form
│           │   ├── SessionPage.tsx  # Live session view (status + chat)
│           │   ├── ChatLog.tsx      # Real-time chat log via SSE
│           │   ├── SessionStatus.tsx # FSM state, build progress
│           │   └── SessionSummary.tsx # Post-session score card
│           ├── hooks/
│           │   ├── use-upload.ts
│           │   ├── use-session.ts
│           │   └── use-stream.ts   # SSE subscription
│           └── store/
│               └── index.ts        # Zustand store
│
└── mc-server/                      # Minecraft server (gitignored except scripts)
    ├── setup.sh                    # Copies server.jar, writes configs, accepts EULA
    ├── start.sh                    # java -Xmx2G -jar server.jar nogui
    └── server.properties.template
```

---

## Implementation Phases

### Phase 0: Scaffolding (first)
1. Init git repo, create root `package.json` with npm workspaces
2. Create `tsconfig.base.json` (strict, ESNext, NodeNext module resolution)
3. Scaffold all 4 packages with `package.json` + `tsconfig.json`
4. Set up `.env.example`, `.gitignore`
5. Create `mc-server/setup.sh` — copies server.jar, writes `eula.txt`, generates `server.properties` (superflat, creative, peaceful, `online-mode=false`, `enforce-secure-profile=false`)
6. Create `mc-server/start.sh`
7. Create minimal `packages/bot/src/index.ts` — Mineflayer bot connects to localhost:25565, logs "Bot spawned"
8. **Verify**: MC server starts, bot connects

### Phase 1: Shared Schemas + Gemini Client
1. Define Zod schemas: `ExperiencePackage`, `BuildPlan`, `SessionState`, SSE events
2. Build Gemini client wrapper (`generateJSON<T>(system, user, schema)`) with retry logic
3. Write Model 1 system prompt (experience planner)
4. Write Model 2 system prompt (scene builder)
5. **Verify**: Call Gemini with a test chapter, get valid ExperiencePackage JSON back

### Phase 2: Express Server + Upload Flow
1. Express app with CORS, JSON parser, error handler
2. Routes: `POST /api/upload`, `GET /api/sessions/:id`, `GET /api/sessions/:id/stream` (SSE)
3. File-based session storage (`.storage/sessions/{id}/`)
4. Upload service: extract text from PDF (pdf-parse) / DOCX (mammoth) / TXT
5. Experience planner service: upload text -> Gemini Model 1 -> ExperiencePackage
6. Bot bridge service: EventEmitter connecting server <-> bot
7. SSE event buffer
8. **Verify**: Upload a file via curl, get session ID, see ExperiencePackage in storage

### Phase 3: Scene Builder
1. Block placer: execute `/setblock` and `/fill` commands via `bot.chat()`, throttled (10 cmds/batch, 100ms delay)
2. Build templates (start with 6): `flat_path`, `simple_house`, `wall_segment`, `sign_post`, `torch_line`, `item_chest`, `arch`, `rubble_pile`
3. Scene builder orchestrator: Gemini Model 2 -> BuildPlan -> expand templates -> BlockPlacement[] -> optimize to /fill commands -> execute
4. World cleanup: `/fill` clear 100x100 area before each build
5. Walkability checker: pathfind between region centers
6. **Verify**: Generate and build a Pompeii-like scene, walk through it in MC client

### Phase 4: Tutor FSM Runtime
1. FSM framework: `TutorState` interface (`onEnter`, `onTick`, `onChat`, `onExit`), `TutorFSM` controller (500ms tick loop + chat listener)
2. States in order:
   - `IDLE` -> `BUILD_SCENE` (invoke scene builder)
   - `WAIT_FOR_PLAYER` (detect player within 10 blocks)
   - `INTRODUCE` (narrate theme, 10s or "ready")
   - `ESCORT_TO_REGION` (pathfinder to next region center)
   - `NARRATE` (deliver region dialogue via chat)
   - `ASK_QUESTION` (send question, wait for chat response)
   - `EVALUATE_ANSWER` (keyword/concept matching -> HINT/REASK/ADVANCE)
   - `MONITOR_OBJECTIVE` (hint toward hidden item)
   - `CLIMAX_RECAP` (final summary question)
   - `END_SESSION` (print score, emit session_complete)
3. Player tracker: poll `bot.players` for position
4. Escort logic: `mineflayer-pathfinder` goto with dynamic goal following
5. **Verify**: Full FSM cycle with a human player in MC client

### Phase 5: Answer Evaluation + Assessment
1. Answer evaluator: fuzzy keyword/concept matching (substring, word overlap Jaccard, edit distance for typos)
2. Feedback generator: middle-school-friendly, never says "wrong"
3. Session tracker: per-question attempts, hints, correctness, time
4. Summary generator: final score, per-question breakdown
5. **Verify**: Test with various student-like responses

### Phase 6: React Frontend
1. Vite + React + Tailwind + Zustand setup
2. `UploadPage`: file dropzone, grade level dropdown, topic input, question count slider
3. `SessionPage`: two-column (status left, chat right)
4. `ChatLog`: SSE subscription, auto-scroll
5. `SessionStatus`: FSM state with friendly labels, build progress bar
6. `SessionSummary`: score card after session ends
7. **Verify**: Full teacher workflow in browser

### Phase 7: Integration + Polish
1. End-to-end test with real chapter text
2. Tune Gemini prompts based on output quality
3. Bot OP automation (add to ops.json on setup)
4. Error recovery (bot reconnect, Gemini retries)
5. `run.sh` that launches MC server + backend + frontend with cleanup trap

---

## Key Technical Details

### Gemini Client
```typescript
// Uses @google/generative-ai SDK
const model = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: zodToGeminiSchema(schema),
  },
});
```
- JSON mode for structured output
- Retry with backoff (3 attempts)
- Zod schema -> Gemini schema conversion

### Build Execution Pipeline
1. **Gemini Model 2** -> `BuildPlan` JSON (which templates, where, what palette)
2. **Template expansion** -> `BlockPlacement[]` (array of {x, y, z, block})
3. **Optimize** -> Group same-type blocks into `/fill` rectangular regions
4. **Execute** -> Send commands via `bot.chat()`, throttled at ~100 cmds/sec

### FSM Core Interface
```typescript
interface TutorState {
  name: string;
  onEnter(ctx: TutorContext): Promise<void>;
  onTick(ctx: TutorContext): Promise<StateTransition | null>;
  onChat(ctx: TutorContext, username: string, message: string): Promise<StateTransition | null>;
  onExit(ctx: TutorContext): Promise<void>;
}
```
- 500ms tick loop for proximity/time triggers
- Chat events routed to current state for answer evaluation

### Answer Evaluation (MVP)
- Keyword/concept matching with fuzzy string comparison
- No LLM call (keeps latency under 1ms)
- Progressive hints from ExperiencePackage question plan
- Middle-school-friendly feedback templates

### MC Server Properties
```properties
level-type=minecraft\:flat
gamemode=creative
difficulty=peaceful
online-mode=false
enforce-secure-profile=false
spawn-protection=0
enable-command-block=true
pvp=false
generate-structures=false
```

### Bot OP Setup
- `ops.json` created by `setup.sh` with bot username
- Bot needs OP for `/setblock`, `/fill`, `/data merge` (signs, chests)

### World Cleanup Between Sessions
- Clear area: `/fill -50 -64 -50 50 100 50 minecraft:air`
- Restore ground: `/fill -50 3 -50 50 3 50 minecraft:grass_block`
- Teleport player to spawn: bot sends `/tp @p 0 4 0`

---

## Dependencies

### `@quizcraft/shared`
- `zod` ^3.23

### `@quizcraft/server`
- `express`, `cors`, `multer` (HTTP + uploads)
- `@google/generative-ai` (Gemini SDK)
- `pdf-parse`, `mammoth` (document extraction)
- `uuid`, `dotenv`
- `tsx` (dev)

### `@quizcraft/bot`
- `mineflayer` ^4.35
- `mineflayer-pathfinder` ^2.4
- `mineflayer-collectblock` ^1.6 (optional)
- `vec3`
- `@google/generative-ai` (for Model 2 calls)
- `dotenv`
- `tsx` (dev)

### `@quizcraft/frontend`
- `react` ^18.3, `react-dom`, `react-router-dom` ^6.26
- `zustand` ^4.5
- `tailwindcss` ^3.4
- `lucide-react` (icons)
- `vite`, `@vitejs/plugin-react`

---

## Verification Plan

1. **Phase 0**: `mc-server/setup.sh && mc-server/start.sh` -> server boots. Run bot -> "Bot spawned" in console.
2. **Phase 1**: `npx tsx test-gemini.ts` with sample chapter -> valid JSON output matching ExperiencePackage schema.
3. **Phase 2**: `curl -X POST -F "file=@chapter.txt" localhost:3000/api/upload` -> 201 with sessionId. `curl localhost:3000/api/sessions/{id}` -> session with ExperiencePackage.
4. **Phase 3**: Start session -> watch blocks appear in MC client. Walk through scene. All regions reachable.
5. **Phase 4**: Join MC, bot greets, escorts through regions, asks questions, evaluates answers, finds item, session ends with score.
6. **Phase 6**: Open `localhost:5173`, upload file, watch session progress, see chat log, see final score.
7. **Full E2E**: Upload a chapter on Pompeii -> complete full session as student -> teacher sees summary in browser.
