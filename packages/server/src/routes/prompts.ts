import { promises as fs } from "node:fs";
import path from "node:path";

import { Router } from "express";

import { config } from "../config.js";

const PROMPT_FILES = [
  "experience-planner.txt",
  "scene-builder.txt",
  "scene-builder-bot.txt",
] as const;

export const promptsRouter = Router();

promptsRouter.get("/", async (_req, res, next) => {
  try {
    const contents: Record<string, string> = {};
    for (const name of PROMPT_FILES) {
      const filePath = path.join(config.promptsDir, name);
      try {
        contents[name] = await fs.readFile(filePath, "utf8");
      } catch {
        contents[name] = "";
      }
    }
    res.json({
      promptsDir: config.promptsDir,
      prompts: {
        experiencePlanner: contents["experience-planner.txt"],
        sceneBuilder: contents["scene-builder.txt"],
        sceneBuilderBot: contents["scene-builder-bot.txt"],
      },
    });
  } catch (error) {
    next(error);
  }
});
