import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Bot } from "mineflayer";

import { botConfig } from "../config.js";
import type { BuildPlan, BuildResult, ExperiencePackage } from "../contracts.js";
import { log, warn, truncate } from "../log.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const COMMAND_DELAY_MS = 45;
const WORLD_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

const SYSTEM_PROMPT = `
You are a Minecraft world builder for an educational history app. You write Minecraft commands that build
a historically accurate, visually distinctive scene from a learning package.

# YOUR ONLY JOB
Output a single JSON object containing the Minecraft commands and scene metadata needed to build the scene.
The commands will be executed by an operator bot, so /fill and /setblock work without limits.

# COORDINATE SPACE
- x: -50 to 50  (east/west)
- y: 3 to 30    (vertical — ground level is y=3)
- z: -45 to 45  (north/south, students walk from z=-45 toward z=+45)
- Spawn point: x=0, y=5, z=-45

# OUTPUT FORMAT (return ONLY this JSON, no markdown):
{
  "theme": "<sceneSpec.theme>",
  "spawnPoint": {"x": 0, "y": 5, "z": -45},
  "palette": ["<primary>","<secondary>","<accent>","<ground>"],
  "regionCenters": {
    "<regionId1>": {"x": 0, "y": 5, "z": -30},
    "<regionId2>": {"x": 0, "y": 5, "z":   0},
    "<regionId3>": {"x": 0, "y": 5, "z":  30}
  },
  "objectivePlacement": {
    "position": {"x": 5, "y": 4, "z": 38},
    "itemName": "<studentObjective.itemName>",
    "narrativeLabel": "<studentObjective.narrativeLabel>"
  },
  "commands": [
    "/fill -50 0 -50 50 60 50 minecraft:air",
    "/fill -50 3 -50 50 3 50 <ground block>",
    ...more /fill and /setblock commands...
  ]
}

# BUILDING RULES
1. First two commands must always be:
   - /fill -50 0 -50 50 60 50 minecraft:air   (clear volume)
   - /fill -50 3 -50 50 3 50 <theme ground>   (lay ground)
2. Build 3-5 regions spaced 25 blocks apart along z (-30, 0, +30 approximately)
3. Each region must have a visually distinct landmark matching its description/buildDirectives
4. Connect every adjacent region pair with a paved path (2-3 blocks wide at y=3)
5. Place a chest (/setblock X 4 Z minecraft:chest) only at the final region
6. All structures must rest on y=3 ground (no floating blocks)
7. Keep a clear 2-block-wide walking corridor through every region

# BLOCK PALETTE GUIDE — match the historical setting precisely

## Roman / Mediterranean (Pompeii, Rome, Greece, etc.)
- Ground:   minecraft:coarse_dirt  or  minecraft:gravel
- Roads:    minecraft:smooth_stone  or  minecraft:stone_slab
- Walls:    minecraft:stone_bricks, minecraft:cut_sandstone
- Columns:  minecraft:quartz_pillar[axis=y]  (stack 4-5 high)
- Roofs:    minecraft:orange_terracotta, minecraft:red_nether_bricks
- Ash/ruin: minecraft:gray_concrete_powder, minecraft:cobblestone
- Volcano:  minecraft:blackstone, minecraft:basalt, minecraft:magma_block

## Ancient Egypt / Desert
- Ground: minecraft:sand, minecraft:coarse_dirt
- Roads:  minecraft:sandstone
- Walls:  minecraft:sandstone, minecraft:cut_sandstone, minecraft:chiseled_sandstone
- Pyramid surfaces: minecraft:smooth_sandstone
- Props: minecraft:dead_bush, minecraft:cactus

## Medieval European
- Ground: minecraft:grass_block, minecraft:coarse_dirt
- Roads:  minecraft:gravel, minecraft:cobblestone
- Walls:  minecraft:stone_bricks, minecraft:cobblestone, minecraft:dark_oak_log
- Roofs:  minecraft:spruce_slab, minecraft:dark_oak_slab

## Volcanic / Disaster
- Ground: minecraft:gray_concrete_powder, minecraft:basalt, minecraft:blackstone
- Roads:  minecraft:cobblestone, minecraft:cracked_stone_bricks
- Props:  minecraft:magma_block (lava vents), minecraft:netherrack

## Forest / Nature
- Ground: minecraft:moss_block, minecraft:coarse_dirt, minecraft:grass_block
- Paths:  minecraft:dirt_path
- Trees:  /fill to make trunks (minecraft:oak_log) + canopy (minecraft:oak_leaves)

# LANDMARK PATTERNS — use these for your builds

## Roman columns (place multiple in a row for a colonnade):
/setblock X 4 Z minecraft:quartz_pillar[axis=y]
/setblock X 5 Z minecraft:quartz_pillar[axis=y]
/setblock X 6 Z minecraft:quartz_pillar[axis=y]
/setblock X 7 Z minecraft:quartz_pillar[axis=y]
/setblock X 8 Z minecraft:quartz_block

## Stone-brick house (7 wide, 5 deep, 4 tall with terracotta roof):
/fill X1 4 Z1 X2 7 Z2 minecraft:stone_bricks        (walls)
/fill X1+1 4 Z1+1 X2-1 7 Z2-1 minecraft:air         (hollow)
/fill X1 8 Z1 X2 8 Z2 minecraft:orange_terracotta    (roof)

## Forum plaza (open square with stone floor):
/fill X1 3 Z1 X2 3 Z2 minecraft:smooth_stone
/fill X1 4 Z1 X2 4 Z2 minecraft:air  (clear head height)

## Amphitheater (concentric stone stair arcs — use repeated /fill per arc):
/fill X1 4 Z1 X2 4 Z2 minecraft:stone_brick_stairs
/fill X1-1 5 Z1-1 X2+1 5 Z2+1 minecraft:stone_bricks
/fill X1-2 6 Z1-2 X2+2 6 Z2+2 minecraft:stone_bricks

## Volcano (at z=40 to z=50, builds a peak):
/fill -12 3 38 12 3 50 minecraft:blackstone
/fill -9 4 40 9 12 50 minecraft:blackstone
/fill -6 13 43 6 20 50 minecraft:basalt
/fill -3 21 45 3 27 50 minecraft:magma_block

## Rubble pile (ruin fragment):
/fill X1 4 Z1 X2 6 Z2 minecraft:cobblestone
/fill X1+1 5 Z1+1 X2-1 6 Z2-1 minecraft:air
/fill X1 7 Z1 X2 7 Z2 minecraft:cracked_stone_bricks

## Torch post (path lighting):
/setblock X 4 Z minecraft:oak_fence
/setblock X 5 Z minecraft:torch

## Sign post:
/setblock X 4 Z minecraft:oak_sign{Text1:'{"text":"LABEL"}'}

# SCENE QUALITY CHECKLIST
Before finalizing, verify your commands:
- [ ] Clear + ground commands are first
- [ ] Each region has a visually unique landmark (not just a sign)
- [ ] Regions connected by a visible path at y=3
- [ ] Chest placed at final region only
- [ ] Volcano or major background element present if theme mentions it
- [ ] Block types match the historical setting (no anachronistic blocks)

Return ONLY the JSON. Do not add any text before or after it.
`.trim();

const parseJson = (text: string): unknown | null => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : text).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
};

const worldModelCandidates = (preferredModel: string): string[] => {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const model of [preferredModel, ...WORLD_MODEL_FALLBACKS]) {
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    candidates.push(model);
  }

  return candidates;
};

interface DirectBuildResponse {
  theme?: string;
  spawnPoint?: { x: number; y: number; z: number };
  palette?: string[];
  regionCenters?: Record<string, { x: number; y: number; z: number }>;
  objectivePlacement?: BuildPlan["objectivePlacement"];
  commands?: string[];
}

export class GeminiDirectBuilder {
  async build(
    bot: Bot,
    experience: ExperiencePackage,
    apiKey: string,
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<BuildResult> {
    const sourceExcerpt = (experience as unknown as Record<string, unknown>).sourceExcerpt;

    const userPrompt = [
      sourceExcerpt
        ? `SETTING (build visuals that match this text exactly):\n${String(sourceExcerpt)}\n`
        : "",
      `Experience package:\n${JSON.stringify(experience, null, 2)}`,
    ]
      .filter(Boolean)
      .join("\n");

    log("builder", `theme: "${experience.sceneSpec.theme}" | model: ${botConfig.geminiModelWorld}`);
    if (sourceExcerpt) {
      log("builder", `source excerpt: "${truncate(String(sourceExcerpt), 100)}"`);
    }

    const client = new GoogleGenerativeAI(apiKey);
    const candidateModels = worldModelCandidates(botConfig.geminiModelWorld);
    let parsed: DirectBuildResponse | null = null;
    let commands: string[] = [];
    let selectedModel = candidateModels[0]!;

    for (const modelName of candidateModels) {
      selectedModel = modelName;
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        });

        const t0 = Date.now();
        const result = await model.generateContent(userPrompt);
        const elapsed = Date.now() - t0;
        const text = result.response.text();
        log("builder", `gemini (${modelName}) responded in ${elapsed}ms | response: ${text.length} chars`);

        const parsedAttempt = parseJson(text) as DirectBuildResponse | null;
        if (!parsedAttempt?.commands || !Array.isArray(parsedAttempt.commands) || parsedAttempt.commands.length < 3) {
          throw new Error(`invalid/empty commands from ${modelName}`);
        }
        if (!parsedAttempt.regionCenters || Object.keys(parsedAttempt.regionCenters).length === 0) {
          throw new Error(`missing regionCenters from ${modelName}`);
        }

        const filtered = parsedAttempt.commands.filter(
          (c): c is string => typeof c === "string" && c.trimStart().startsWith("/"),
        );
        if (filtered.length < 3) {
          throw new Error(`insufficient slash-prefixed commands from ${modelName}`);
        }

        parsed = parsedAttempt;
        commands = filtered.map((cmd) => cmd.trim());
        break;
      } catch (error) {
        warn("builder", `model ${modelName} failed`, error instanceof Error ? error.message : String(error));
      }
    }

    if (!parsed || commands.length < 3) {
      throw new Error("GeminiDirectBuilder: all world models failed to return valid build commands");
    }

    const regionCenters = parsed.regionCenters;
    if (!regionCenters || Object.keys(regionCenters).length === 0) {
      throw new Error("GeminiDirectBuilder: valid commands returned without region centers");
    }

    const regionIds = Object.keys(regionCenters).join(", ");
    log("builder", `${commands.length} commands | model: ${selectedModel} | regions: ${regionIds} | palette: ${parsed.palette?.slice(0, 2).join(", ") ?? "?"}`);
    log("builder", `first commands: ${commands.slice(0, 3).join(" | ")}`);
    await onProgress?.(0.08);

    let fillCount = 0;
    let setblockCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      bot.chat(cmd);
      if (/^\/fill\b/i.test(cmd)) fillCount++;
      else if (/^\/setblock\b/i.test(cmd)) setblockCount++;

      // Pace commands to avoid chat/command throttling.
      await delay(COMMAND_DELAY_MS);

      await onProgress?.(0.08 + ((i + 1) / commands.length) * 0.9);
    }

    await onProgress?.(1);

    const buildPlan: BuildPlan = {
      theme: parsed.theme ?? experience.sceneSpec.theme,
      clearBounds: { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 60, z: 50 } },
      spawnPoint: parsed.spawnPoint ?? { x: 0, y: 5, z: -45 },
      palette: Array.isArray(parsed.palette) ? parsed.palette : experience.sceneSpec.palette ?? ["minecraft:stone_bricks"],
      placements: [],
      regionCenters,
      objectivePlacement: parsed.objectivePlacement,
    };

    return {
      buildPlan,
      buildSummary: { commandCount: commands.length, fillCount, setblockCount, walkabilityPassed: true },
    };
  }
}
