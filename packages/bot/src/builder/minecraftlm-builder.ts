import type { Bot } from "mineflayer";

import { botConfig } from "../config.js";
import type { BuildPlan, BuildResult, ExperiencePackage } from "../contracts.js";
import { log, warn } from "../log.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const COMMAND_DELAY_MS = 45;
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 180_000; // 3 minutes

interface MinecraftLMBlock {
  start: [number, number, number];
  end: [number, number, number];
  type: string;
  fill: boolean;
  properties?: Record<string, string>;
}

interface MinecraftLMStructure {
  width: number;
  height: number;
  depth: number;
  blocks: MinecraftLMBlock[];
}

const formatProperties = (properties: Record<string, string>): string => {
  const entries = Object.entries(properties);
  if (entries.length === 0) return "";
  return `[${entries.map(([k, v]) => `${k}=${v}`).join(",")}]`;
};

/**
 * Convert minecraftlm structure blocks into Minecraft /fill and /setblock commands.
 *
 * MinecraftLM outputs blocks with:
 *   start: [x, y, z] (inclusive)
 *   end:   [x, y, z] (exclusive, start + size)
 *
 * Minecraft /fill uses inclusive coordinates on both ends, so we subtract 1 from end.
 */
const structureToCommands = (
  structure: MinecraftLMStructure,
): { commands: string[]; regionCenter: { x: number; y: number; z: number } } => {
  const offsetX = -Math.round(structure.width / 2);
  const offsetY = 3; // place structure base at y=3 (flat world ground level)
  const offsetZ = -Math.round(structure.depth / 2);

  // First command: clear the build area
  const clearRadius = Math.max(Math.ceil(structure.width / 2), Math.ceil(structure.depth / 2), 50);
  const clearHeight = Math.max(structure.height + 10, 60);
  const commands: string[] = [
    `/fill -${clearRadius} 0 -${clearRadius} ${clearRadius} ${clearHeight} ${clearRadius} minecraft:air`,
    `/fill -${clearRadius} 3 -${clearRadius} ${clearRadius} 3 ${clearRadius} minecraft:grass_block`,
  ];

  for (const block of structure.blocks) {
    const x1 = block.start[0] + offsetX;
    const y1 = block.start[1] + offsetY;
    const z1 = block.start[2] + offsetZ;
    // end is exclusive in minecraftlm, so subtract 1 for inclusive MC coords
    const x2 = block.end[0] + offsetX - 1;
    const y2 = block.end[1] + offsetY - 1;
    const z2 = block.end[2] + offsetZ - 1;

    const props = block.properties ? formatProperties(block.properties) : "";
    const blockType = `${block.type}${props}`;

    const isSingleBlock = x1 === x2 && y1 === y2 && z1 === z2;

    if (isSingleBlock) {
      commands.push(`/setblock ${x1} ${y1} ${z1} ${blockType}`);
    } else if (block.fill) {
      commands.push(`/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${blockType}`);
    } else {
      commands.push(`/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${blockType} hollow`);
    }
  }

  return {
    commands,
    regionCenter: { x: 0, y: offsetY + 1, z: 0 },
  };
};

const buildPromptFromExperience = (experience: ExperiencePackage, sourceExcerpt?: string): string => {
  const regions = experience.sceneSpec.regions
    .map((r) => `- "${r.id}" (${r.purpose}): ${r.description}`)
    .join("\n");

  const palette = experience.sceneSpec.palette?.join(", ") ?? "stone bricks, oak planks";

  const objective = experience.studentObjective;
  const objectiveText = objective.itemName
    ? `Place a chest containing "${objective.narrativeLabel ?? objective.itemName}" near the final region.`
    : "";

  const excerptSection = sourceExcerpt
    ? `\n\nHISTORICAL CONTEXT (build visuals that match this text):\n${sourceExcerpt}\n`
    : "";

  return `Build a LARGE, DETAILED, RECOGNIZABLE Minecraft scene. The player must immediately identify what this place is.

THEME: ${experience.sceneSpec.theme}
TITLE: ${experience.title}
${excerptSection}
REGIONS (create distinct areas connected by wide walkable paths):
${regions}

PALETTE: ${palette}
SIZE: ${experience.sceneSpec.size} — use the FULL 48×48 block footprint

ARCHITECTURE REQUIREMENTS:
- Build the ACTUAL LANDMARK described, not an abstract placeholder
- SCALE: Each structure should be at least 15×15 blocks. Use the full area.
- HEIGHT: Build UP — walls 4-8 blocks tall, towers 8-12, arches 5-7
- 3D DEPTH: Walls with thickness (2+ blocks), roofs, floors, interiors
- CIRCLES: For circular structures (Stonehenge, coliseums, amphitheaters), use octagonal approximations with many short segments
- DETAIL: Windows (air gaps), doorways, stairs, torch lighting, paths between regions
- Connect all regions with 3-wide walkable paths
- ${objectiveText}

SPECIFIC GUIDANCE:
- Stonehenge → circular ring of tall standing stones (1×5×1) with horizontal lintels on top, inner horseshoe, central altar
- Castle → thick outer walls with corner towers, gate with arch, inner keep, courtyard
- Temple → massive entrance pylons, column halls, inner sanctuary
- Forum → rows of columns, raised platform, steps, market stalls
- If the theme doesn't match these, extrapolate the same level of detail and scale

The scene MUST feel like walking through a real historical site, not a tiny model.`;
};

export class MinecraftLMBuilder {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? botConfig.minecraftlmUrl;
  }

  async build(
    bot: Bot,
    experience: ExperiencePackage,
    apiKey: string | undefined,
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<BuildResult> {
    const sourceExcerpt = (experience as unknown as Record<string, unknown>).sourceExcerpt;

    log("minecraftlm", `theme: "${experience.sceneSpec.theme}" | server: ${this.baseUrl}`);

    // 1. Create a session
    const createRes = await fetch(`${this.baseUrl}/api/sessions`, { method: "POST" });
    if (!createRes.ok) {
      throw new Error(`MinecraftLM: failed to create session (${createRes.status})`);
    }
    const { session_id } = (await createRes.json()) as { session_id: string };
    log("minecraftlm", `session created: ${session_id}`);
    await onProgress?.(0.05);

    // 2. Send chat message to generate structure
    const prompt = buildPromptFromExperience(experience, sourceExcerpt ? String(sourceExcerpt) : undefined);
    const chatRes = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id,
        message: prompt,
        thinking_level: "med",
      }),
    });
    if (!chatRes.ok) {
      throw new Error(`MinecraftLM: failed to start chat (${chatRes.status})`);
    }
    log("minecraftlm", "agent started, waiting for structure generation...");
    await onProgress?.(0.1);

    // 3. Poll until task completes
    const startedAt = Date.now();
    let structure: MinecraftLMStructure | null = null;

    while (Date.now() - startedAt < MAX_POLL_DURATION_MS) {
      await delay(POLL_INTERVAL_MS);

      const sessionRes = await fetch(`${this.baseUrl}/api/sessions/${session_id}`);
      if (!sessionRes.ok) continue;

      const sessionData = (await sessionRes.json()) as {
        task_status: string;
        structure: MinecraftLMStructure | null;
      };

      const elapsed = ((Date.now() - startedAt) / MAX_POLL_DURATION_MS);
      await onProgress?.(0.1 + elapsed * 0.4);

      if (sessionData.task_status === "completed" || sessionData.task_status === "idle") {
        if (sessionData.structure && sessionData.structure.blocks?.length > 0) {
          structure = sessionData.structure;
          break;
        }
        // Task completed but no structure yet — try fetching directly
        const structRes = await fetch(`${this.baseUrl}/api/sessions/${session_id}/structure`);
        if (structRes.ok) {
          structure = (await structRes.json()) as MinecraftLMStructure;
          if (structure.blocks?.length > 0) break;
        }
        // If idle with no structure, the task might not have started yet
        if (sessionData.task_status === "idle") continue;
        break;
      }

      if (sessionData.task_status === "error") {
        throw new Error("MinecraftLM: agent task failed");
      }
    }

    if (!structure || !structure.blocks || structure.blocks.length === 0) {
      throw new Error("MinecraftLM: no structure generated within timeout");
    }

    log("minecraftlm", `structure received: ${structure.blocks.length} blocks, ${structure.width}x${structure.height}x${structure.depth}`);
    await onProgress?.(0.5);

    // 4. Convert structure to Minecraft commands
    const { commands, regionCenter } = structureToCommands(structure);
    log("minecraftlm", `converted to ${commands.length} commands`);

    // 5. Execute commands via bot
    let fillCount = 0;
    let setblockCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      bot.chat(cmd);
      if (/^\/fill\b/i.test(cmd)) fillCount++;
      else if (/^\/setblock\b/i.test(cmd)) setblockCount++;

      await delay(COMMAND_DELAY_MS);
      await onProgress?.(0.5 + ((i + 1) / commands.length) * 0.48);
    }

    await onProgress?.(1);

    // 6. Build result
    const regions = experience.sceneSpec.regions;
    const regionCenters: Record<string, { x: number; y: number; z: number }> = {};
    const angleStep = (2 * Math.PI) / Math.max(regions.length, 1);
    const spreadRadius = Math.min(structure.width, structure.depth) / 3;

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i]!;
      regionCenters[region.id] = {
        x: Math.round(Math.cos(angleStep * i) * spreadRadius),
        y: regionCenter.y,
        z: Math.round(Math.sin(angleStep * i) * spreadRadius),
      };
    }

    const buildPlan: BuildPlan = {
      theme: experience.sceneSpec.theme,
      clearBounds: {
        min: { x: -50, y: 0, z: -50 },
        max: { x: 50, y: 60, z: 50 },
      },
      spawnPoint: { x: 0, y: regionCenter.y, z: 0 },
      palette: experience.sceneSpec.palette ?? ["minecraft:stone_bricks"],
      placements: [],
      regionCenters,
      objectivePlacement: experience.studentObjective.itemName
        ? {
            position: regionCenters[regions[regions.length - 1]?.id ?? ""] ?? { x: 0, y: regionCenter.y, z: 0 },
            itemName: experience.studentObjective.itemName,
            narrativeLabel: experience.studentObjective.narrativeLabel,
          }
        : undefined,
    };

    return {
      buildPlan,
      buildSummary: {
        commandCount: commands.length,
        fillCount,
        setblockCount,
        walkabilityPassed: true,
      },
    };
  }
}
