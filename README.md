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
- Minecraft server jar kept in the repo at `mc-server/server.jar`
- Optional Gemini key in `.env` as `GEMINI_API_KEY`

## Setup

1. Copy `.env.example` to `.env` and add `GEMINI_API_KEY` if you want Gemini planning instead of the built-in fallback planner.
2. Install dependencies:

```bash
npm install
```

3. Configure the local Minecraft server:

```bash
./mc-server/setup.sh
```

## Run

Start the Minecraft server, API, bot, and frontend together:

```bash
./run.sh
```

Services:

- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:3000`
- Minecraft server: `127.0.0.1:25565`

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
