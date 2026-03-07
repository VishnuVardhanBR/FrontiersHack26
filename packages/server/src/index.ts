import cors from "cors";
import express from "express";

import { config, frontendOrigins } from "./config.js";
import { internalRouter } from "./routes/internal.js";
import { sessionRouter } from "./routes/session.js";
import { streamRouter } from "./routes/stream.js";
import { uploadRouter } from "./routes/upload.js";

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed.`));
  },
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "quizcraft-server",
  });
});

app.use("/api/upload", uploadRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/sessions", streamRouter);
app.use("/internal", internalRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  res.status(500).json({ error: message });
});

app.listen(config.serverPort, config.serverHost, () => {
  console.log(`QuizCraft server listening on http://${config.serverHost}:${config.serverPort}`);
});
