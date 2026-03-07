# QuizCraft

QuizCraft turns a teacher-uploaded history chapter into a short Minecraft learning session. A local Mineflayer tutor bot builds a compact scene, narrates the lesson, escorts the player between regions, asks chat questions, and produces a session summary for the teacher dashboard.

## Workspace

- `packages/shared`: shared schemas, types, and constants
- `packages/server`: Express upload/session/SSE API and Gemini planner
- `packages/bot`: Mineflayer bot runtime, scene builder, and tutor FSM
- `packages/frontend`: React teacher workflow UI
- `mc-server`: local Minecraft server setup and launch scripts

## Requirements

- Node.js 20+
- Java 21+ for the Minecraft server jar
- Minecraft server jar: download from [minecraft.net/download/server](https://www.minecraft.net/en-us/download/server) and save as `mc-server/server.jar` (or set `MC_SERVER_JAR_SOURCE` to its path)
- Optional Gemini key in `.env` as `GEMINI_API_KEY`

## Setup

1. Copy `.env.example` to `.env` and add `GEMINI_API_KEY` if you want Gemini planning instead of the built-in fallback planner.
2. Install dependencies:

```bash
npm install
```

3. Minecraft server (one-time): download [server jar](https://www.minecraft.net/en-us/download/server), save as `mc-server/server.jar`, then:

```bash
./mc-server/setup.sh
```

## Run (minimal)

**All-in-one:**

```bash
./run.sh
```

**Or by hand (same order):**

```bash
./mc-server/start.sh &          # MC server
sleep 8 && npm run dev:server & # API
sleep 2 && npm run dev:bot &    # Bot
npm run dev:frontend            # UI → http://localhost:5173
```

Services:

- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:3000`
- Minecraft server: `127.0.0.1:25565`

### Run order and validation

If you start pieces by hand, start them in this order so the bot and frontend can reach their backends:

1. **Minecraft server** – `./mc-server/start.sh` (so the bot can connect to `127.0.0.1:25565`)
2. **API server** – `npm run dev:server` (so the frontend and bot storage can use `http://localhost:3000`)
3. **Bot** – `npm run dev:bot` (connects to MC with retries; exits after 5 failed attempts with a clear message)
4. **Frontend** – `npm run dev:frontend` (needs the API for upload and demo)

Check that required services are up:

```bash
./validate.sh
```

This reports which of the Minecraft server and API server are reachable and suggests what to start. Use it before or after starting services to avoid connection-refused loops.

### Library of Alexandria demo

The **"Render scene & start"** button on the upload page needs the **API server running** (it POSTs to `/api/demo/library-alexandria`). If you see "Failed to fetch", start the API with `npm run dev:server` first, then click the button again.

The bot runs whatever session is next in its queue. If it’s already in another session (e.g. an old "Aqua Roma" or chapter upload), you’ll see that scene and dialogue until that session ends. After it finishes, the bot will pick up the Alexandria session if you queued it. To run only Alexandria, you can clear old sessions from `.storage/sessions/` and restart the bot, then use "Render scene & start" with the API up.

## Verification

Typecheck every workspace:

```bash
npm run typecheck
```

Build every workspace:

```bash
npm run build
```

## Teacher Flow

1. Open the frontend.
2. Upload a `.txt`, `.pdf`, or `.docx` chapter.
3. Wait for the bot to claim the queued session and build the scene.
4. Join the Minecraft server as the student.
5. Follow the bot, answer questions in chat, and finish the recap.

Session data is stored under `.storage/sessions/<session-id>/`.

## Generation prompts

All instructions used for experience planning and scene building are surfaced so you can view and edit them:

- **In the app:** Open the frontend, expand **“Generation prompts”** on the upload page to see the current prompt text and copy it.
- **In code:** Prompt files live in `packages/server/src/gemini/prompts/` (experience-planner, scene-builder, scene-builder-bot). The bot’s scene builder uses the inline prompt in `packages/bot/src/builder/scene-builder.ts`; keep `scene-builder-bot.txt` in sync for visibility.
- **Docs:** See `docs/PROMPTS.md` for full content and file paths.
- **API:** `GET /api/prompts` returns all prompt texts.

## Reference: MinecraftLM

The [MinecraftLM](https://github.com/shivraj-S-bhatti/minecraftlm) repo is cloned as `minecraftlm/` in this project (listed in `.gitignore`). Use it to compare techniques (e.g. code generation, spatial reasoning) and improve QuizCraft’s prompts and build pipeline.
