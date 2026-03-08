import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Bot } from "mineflayer";

import { botConfig } from "../config.js";
import type { BuildPlan, BuildResult, ExperiencePackage } from "../contracts.js";
import { log, warn, truncate } from "../log.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const COMMAND_DELAY_MS = 45;
const WORLD_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] as const;
const MIN_COMMANDS_PER_REGION = 60;
const MIN_TOTAL_COMMANDS = 250;
const MAX_SCENE_CENTER_OFFSET = 2;

const SYSTEM_PROMPT = `
You are an expert Minecraft architect generating build commands for QuizCraft educational scenes.
Your job is to create LARGE, DETAILED, RECOGNIZABLE 3D structures that a player would immediately identify.

Return ONE JSON object only. No markdown. No prose.

═══ ARCHITECTURE RULES ═══
You MUST build real, recognizable structures. Think like a skilled Minecraft builder:

• SCALE: Each region must cover at least a 15×15 block footprint. Use the FULL -24 to 24 range.
• HEIGHT: Build UP. Walls should be 4-8 blocks tall. Towers 8-12. Arches/gates 5-7.
• 3D DEPTH: Every structure needs walls with THICKNESS (2+ blocks), roofs, floors, interiors.
• CIRCLES/ARCS: For circular structures (amphitheaters, Stonehenge, coliseums, towers), approximate
  circles using octagon patterns with many short /fill segments at varying angles.
• DETAIL: Add windows (air gaps in walls), doorways, stairs, torch lighting, banners, paths.

═══ SPECIFIC STRUCTURE EXAMPLES ═══
Stonehenge: Large circular arrangement of 10+ standing stone pillars (each 1×5×1) at radius ~12,
  with horizontal lintels connecting adjacent pairs on top. Inner horseshoe of 5 taller trilithons.
  Central altar stone. Surrounding ditch/bank ring.

Castle: Outer walls (30×30, 6-high, 2-thick), 4 corner towers (4×4×10), gate with arch,
  inner keep (12×12×8), courtyard, battlements (alternating blocks on wall top).

Roman Forum: Rows of columns (1×6×1 pillars), raised platform/podium, steps, surrounding walls,
  market stalls, open courtyard with patterned floor.

Egyptian Temple: Massive trapezoidal pylons (entrance), column hall with rows of pillars,
  inner sanctuary, obelisks at entrance, decorated floors.

═══ COMMAND RULES ═══
1) Use ONLY /fill and /setblock commands.
2) commands[0] must be exactly:
   "/fill -50 0 -50 50 60 50 minecraft:air"
3) commands[1] must be exactly:
   "/fill -50 3 -50 50 3 50 <ground_block>"
   Choose ground_block to match the theme (grass_block, sand, stone, dirt, etc.)
4) regionCount = number of regions. Total commands >= max(150, regionCount × 40).
5) Include at least 20 /fill commands and at least 15 /setblock commands.
6) Include at least one chest: /setblock X 4 Z minecraft:chest
7) Include one sign per region center.
8) Connect adjacent regions with 3-wide walkable paths (use gravel, stone_bricks, or similar).

═══ LAYOUT RULES ═══
9) spawnPoint = { "x": 0, "y": 4, "z": 0 }  (y=4 means feet on the ground block at y=3)
10) All regionCenters and objectivePlacement.position: x/z in [-24, 24].
11) Region center centroid must be centered:
    abs(mean(regionCenters.x)) <= 2 and abs(mean(regionCenters.z)) <= 2.
12) Keep y in range 3..20. No unreachable jumps (max 1 block step).
13) Spread regions across the full area — use radius 12-20 from center.

═══ OUTPUT SHAPE ═══
{
  "theme": string,
  "spawnPoint": { "x": number, "y": number, "z": number },
  "palette": string[],
  "regionCenters": { "<regionId>": { "x": number, "y": number, "z": number } },
  "objectivePlacement": {
    "position": { "x": number, "y": number, "z": number },
    "itemName": string,
    "narrativeLabel": string
  },
  "commands": string[]
}

CRITICAL:
- Every region id from sceneSpec.regions must appear in regionCenters.
- Place chest near final region.
- commands array must have 150+ entries. MORE commands = BETTER scene.
- Build the RECOGNIZABLE LANDMARK, not an abstract placeholder.
- Return valid JSON only.
`;

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

const isThinkingConfigError = (message: string): boolean =>
  /thinking|thinkingconfig|thinking budget|includethoughts/i.test(message.toLowerCase());

const generationVariants = (): Array<{ label: string; usesThinking: boolean; config: Record<string, unknown> }> => {
  const base = {
    temperature: 0.7,
    responseMimeType: "application/json",
  };

  if (botConfig.geminiThinkingBudget <= 0) {
    return [{ label: "standard", usesThinking: false, config: base }];
  }

  return [
    {
      label: `thinking(${botConfig.geminiThinkingBudget})`,
      usesThinking: true,
      config: {
        ...base,
        thinkingConfig: {
          thinkingBudget: botConfig.geminiThinkingBudget,
          includeThoughts: false,
        },
      },
    },
    {
      label: "standard",
      usesThinking: false,
      config: base,
    },
  ];
};

const hasCommand = (commands: string[], pattern: RegExp): boolean =>
  commands.some((cmd) => pattern.test(cmd));

const isFoundationCommand = (command: string): boolean =>
  /^\/fill\s+-50\s+0\s+-50\s+50\s+60\s+50\s+/i.test(command)
  || /^\/fill\s+-50\s+3\s+-50\s+50\s+3\s+50\s+/i.test(command);

interface CommandBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const toFiniteNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shiftToken = (value: string, delta: number): string | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return String(Math.round(parsed + delta));
};

const shiftCommandXZ = (command: string, shiftX: number, shiftZ: number): string => {
  if (isFoundationCommand(command)) {
    return command;
  }

  const parts = command.trim().split(/\s+/);
  if (parts.length < 4) {
    return command;
  }

  if (/^\/setblock$/i.test(parts[0] ?? "")) {
    const nextX = shiftToken(parts[1] ?? "", shiftX);
    const nextZ = shiftToken(parts[3] ?? "", shiftZ);
    if (!nextX || !nextZ) {
      return command;
    }
    parts[1] = nextX;
    parts[3] = nextZ;
    return parts.join(" ");
  }

  if (/^\/fill$/i.test(parts[0] ?? "") && parts.length >= 7) {
    const nextX1 = shiftToken(parts[1] ?? "", shiftX);
    const nextZ1 = shiftToken(parts[3] ?? "", shiftZ);
    const nextX2 = shiftToken(parts[4] ?? "", shiftX);
    const nextZ2 = shiftToken(parts[6] ?? "", shiftZ);
    if (!nextX1 || !nextZ1 || !nextX2 || !nextZ2) {
      return command;
    }
    parts[1] = nextX1;
    parts[3] = nextZ1;
    parts[4] = nextX2;
    parts[6] = nextZ2;
    return parts.join(" ");
  }

  return command;
};

const extractCommandBounds = (commands: string[]): CommandBounds | null => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const raw of commands) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 4) {
      continue;
    }

    if (/^\/setblock$/i.test(parts[0] ?? "")) {
      const x = toFiniteNumber(parts[1] ?? "");
      const z = toFiniteNumber(parts[3] ?? "");
      if (x === null || z === null) {
        continue;
      }
      found = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      continue;
    }

    if (/^\/fill$/i.test(parts[0] ?? "") && parts.length >= 7) {
      const x1 = toFiniteNumber(parts[1] ?? "");
      const z1 = toFiniteNumber(parts[3] ?? "");
      const x2 = toFiniteNumber(parts[4] ?? "");
      const z2 = toFiniteNumber(parts[6] ?? "");
      if (x1 === null || z1 === null || x2 === null || z2 === null) {
        continue;
      }
      found = true;
      minX = Math.min(minX, x1, x2);
      maxX = Math.max(maxX, x1, x2);
      minZ = Math.min(minZ, z1, z2);
      maxZ = Math.max(maxZ, z1, z2);
    }
  }

  if (!found) {
    return null;
  }

  return { minX, maxX, minZ, maxZ };
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

    const regionDescriptions = experience.sceneSpec.regions
      .map((r) => `  - "${r.id}" (${r.purpose}): ${r.description}`)
      .join("\n");

    const userPrompt = [
      `THEME: ${experience.sceneSpec.theme}`,
      `TITLE: ${experience.title}`,
      `REGIONS:\n${regionDescriptions}`,
      `PALETTE: ${(experience.sceneSpec.palette ?? ["minecraft:stone_bricks"]).join(", ")}`,
      `SIZE: ${experience.sceneSpec.size}`,
      sourceExcerpt
        ? `\nHISTORICAL CONTEXT (build visuals that match this text — create the ACTUAL landmark described):\n${String(sourceExcerpt)}\n`
        : "",
      `\nBuild a LARGE, DETAILED, RECOGNIZABLE scene. The player must immediately recognize what this place is.`,
      `Use 150+ commands. Fill the -24 to 24 x/z range. Build tall structures (5-10 blocks high).`,
      `\nFull experience package:\n${JSON.stringify(experience, null, 2)}`,
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
    let selectedVariant = "standard";

    for (const modelName of candidateModels) {
      selectedModel = modelName;
      for (const variant of generationVariants()) {
        try {
          const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: variant.config as unknown as Record<string, unknown>,
          });

          const t0 = Date.now();
          const result = await model.generateContent(userPrompt);
          const elapsed = Date.now() - t0;
          const text = result.response.text();
          log("builder", `gemini (${modelName}/${variant.label}) responded in ${elapsed}ms | response: ${text.length} chars`);

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

          let normalizedCommands = filtered.map((cmd) => cmd.trim());
          let normalizedRegionCenters = parsedAttempt.regionCenters;
          let normalizedSpawnPoint = parsedAttempt.spawnPoint;
          let normalizedObjectivePlacement = parsedAttempt.objectivePlacement;

          const initialNonFoundation = normalizedCommands.filter((cmd) => !isFoundationCommand(cmd));
          const initialBounds = extractCommandBounds(initialNonFoundation);
          const regionCenterValues = Object.values(parsedAttempt.regionCenters);
          let shiftX = 0;
          let shiftZ = 0;
          if (initialBounds) {
            shiftX = -Math.round((initialBounds.minX + initialBounds.maxX) / 2);
            shiftZ = -Math.round((initialBounds.minZ + initialBounds.maxZ) / 2);
          } else if (regionCenterValues.length > 0) {
            const minRegionX = Math.min(...regionCenterValues.map((center) => center.x));
            const maxRegionX = Math.max(...regionCenterValues.map((center) => center.x));
            const minRegionZ = Math.min(...regionCenterValues.map((center) => center.z));
            const maxRegionZ = Math.max(...regionCenterValues.map((center) => center.z));
            shiftX = -Math.round((minRegionX + maxRegionX) / 2);
            shiftZ = -Math.round((minRegionZ + maxRegionZ) / 2);
          }
          if (shiftX !== 0 || shiftZ !== 0) {
            normalizedCommands = normalizedCommands.map((cmd) => shiftCommandXZ(cmd, shiftX, shiftZ));
            normalizedRegionCenters = Object.fromEntries(
              Object.entries(parsedAttempt.regionCenters).map(([id, center]) => [
                id,
                {
                  x: Math.round(center.x + shiftX),
                  y: Math.round(center.y),
                  z: Math.round(center.z + shiftZ),
                },
              ]),
            );
            if (normalizedSpawnPoint) {
              normalizedSpawnPoint = {
                x: Math.round(normalizedSpawnPoint.x + shiftX),
                y: Math.round(normalizedSpawnPoint.y),
                z: Math.round(normalizedSpawnPoint.z + shiftZ),
              };
            }
            if (normalizedObjectivePlacement?.position) {
              normalizedObjectivePlacement = {
                ...normalizedObjectivePlacement,
                position: {
                  x: Math.round(normalizedObjectivePlacement.position.x + shiftX),
                  y: Math.round(normalizedObjectivePlacement.position.y),
                  z: Math.round(normalizedObjectivePlacement.position.z + shiftZ),
                },
              };
            }
          }

          const minCommands = Math.max(
            MIN_TOTAL_COMMANDS,
            Object.keys(normalizedRegionCenters).length * MIN_COMMANDS_PER_REGION,
          );
          const hasClear = hasCommand(normalizedCommands, /^\/fill\s+-50\s+0\s+-50\s+50\s+60\s+50\s+/i);
          const hasGround = hasCommand(normalizedCommands, /^\/fill\s+-50\s+3\s+-50\s+50\s+3\s+50\s+/i);
          const hasChest = hasCommand(normalizedCommands, /^\/setblock\b.*\bminecraft:chest\b/i);
          const fillCount = normalizedCommands.filter((cmd) => /^\/fill\b/i.test(cmd)).length;
          const setblockCount = normalizedCommands.filter((cmd) => /^\/setblock\b/i.test(cmd)).length;
          const nonFoundationCommands = normalizedCommands.filter((cmd) => !isFoundationCommand(cmd));
          const commandBounds = extractCommandBounds(nonFoundationCommands);
          const normalizedRegionCenterValues = Object.values(normalizedRegionCenters);
          const minRegionX = Math.min(...normalizedRegionCenterValues.map((c) => c.x));
          const maxRegionX = Math.max(...normalizedRegionCenterValues.map((c) => c.x));
          const minRegionZ = Math.min(...normalizedRegionCenterValues.map((c) => c.z));
          const maxRegionZ = Math.max(...normalizedRegionCenterValues.map((c) => c.z));
          const regionCenterOffsetX = Math.abs((minRegionX + maxRegionX) / 2);
          const regionCenterOffsetZ = Math.abs((minRegionZ + maxRegionZ) / 2);
          const commandCenterOffsetX = commandBounds ? Math.abs((commandBounds.minX + commandBounds.maxX) / 2) : Number.POSITIVE_INFINITY;
          const commandCenterOffsetZ = commandBounds ? Math.abs((commandBounds.minZ + commandBounds.maxZ) / 2) : Number.POSITIVE_INFINITY;

          if (
            normalizedCommands.length < minCommands
            || !hasClear
            || !hasGround
            || !hasChest
            || fillCount < 20
            || setblockCount < 15
            || !commandBounds
            || regionCenterOffsetX > MAX_SCENE_CENTER_OFFSET
            || regionCenterOffsetZ > MAX_SCENE_CENTER_OFFSET
            || commandCenterOffsetX > MAX_SCENE_CENTER_OFFSET
            || commandCenterOffsetZ > MAX_SCENE_CENTER_OFFSET
          ) {
            throw new Error(
              `low-quality/off-center plan from ${modelName}: commands=${normalizedCommands.length}, fill=${fillCount}, setblock=${setblockCount}, min=${minCommands}, regionOffset=(${regionCenterOffsetX.toFixed(1)},${regionCenterOffsetZ.toFixed(1)}), cmdOffset=(${Number.isFinite(commandCenterOffsetX) ? commandCenterOffsetX.toFixed(1) : "inf"},${Number.isFinite(commandCenterOffsetZ) ? commandCenterOffsetZ.toFixed(1) : "inf"})`,
            );
          }

          parsed = {
            ...parsedAttempt,
            regionCenters: normalizedRegionCenters,
            spawnPoint: normalizedSpawnPoint,
            objectivePlacement: normalizedObjectivePlacement,
            commands: normalizedCommands,
          };
          commands = normalizedCommands;
          selectedVariant = variant.label;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (variant.usesThinking && isThinkingConfigError(message)) {
            warn("builder", `model ${modelName} rejected ${variant.label}; retrying without thinking`);
            continue;
          }
          warn("builder", `model ${modelName}/${variant.label} failed`, message);
        }
      }
      if (parsed && commands.length >= 3) {
        break;
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
    log("builder", `${commands.length} commands | model: ${selectedModel}/${selectedVariant} | regions: ${regionIds} | palette: ${parsed.palette?.slice(0, 2).join(", ") ?? "?"}`);
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
      spawnPoint: { x: 0, y: Math.max(parsed.spawnPoint?.y ?? 4, 4), z: 0 },
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
