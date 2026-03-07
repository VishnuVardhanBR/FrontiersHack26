import { promises as fs } from "node:fs";
import path from "node:path";

import { Router } from "express";

import { config } from "../config.js";
import { GeminiClient } from "../gemini/client.js";
import { log } from "../log.js";

export const voiceRouter = Router();

const geminiClient = new GeminiClient();

voiceRouter.post("/sessions/:id/voice-input", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transcript } = req.body as { transcript?: string; username?: string };

    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({ error: "transcript is required." });
      return;
    }

    const sessionDir = path.join(config.storageDir, id);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(path.join(sessionDir, "voice-pending.txt"), transcript.trim(), "utf8");
    log("voice", `session ${id} ← "${transcript.trim().slice(0, 80)}"`);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

voiceRouter.post("/voice/tts", async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text is required." });
      return;
    }

    const audioBuffer = await geminiClient.generateTTS(text);
    res.json({
      audio: audioBuffer.toString("base64"),
      mimeType: "audio/pcm",
    });
  } catch (error) {
    next(error);
  }
});
