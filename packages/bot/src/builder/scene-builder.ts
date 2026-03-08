import type { Bot } from "mineflayer";

import { botConfig } from "../config.js";
import type { BuildResult, SessionState } from "../contracts.js";
import { log, warn } from "../log.js";
import { GeminiDirectBuilder } from "./gemini-direct-builder.js";
import { MinecraftLMBuilder } from "./minecraftlm-builder.js";

export class SceneBuilder {
  private readonly directBuilder = new GeminiDirectBuilder();
  private readonly minecraftlmBuilder = new MinecraftLMBuilder();

  async buildScene(
    bot: Bot,
    session: SessionState,
    apiKey: string | undefined,
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<BuildResult> {
    // Try MinecraftLM first if enabled
    if (botConfig.useMinecraftLM) {
      try {
        log("builder", "attempting build via MinecraftLM...");
        const result = await this.minecraftlmBuilder.build(
          bot,
          session.experiencePackage,
          apiKey,
          onProgress,
        );
        log("builder", "MinecraftLM build succeeded");
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warn("builder", `MinecraftLM failed, falling back to Gemini: ${message}`);
      }
    }

    // Fallback to Gemini direct builder
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required. Refusing to build without Gemini.");
    }

    return this.directBuilder.build(
      bot,
      session.experiencePackage,
      apiKey,
      onProgress,
    );
  }
}
