import type { Bot } from "mineflayer";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { botConfig } from "../config.js";
import {
  BuildPlan,
  BuildResult,
  BuildTemplatePlacement,
  ExperiencePackage,
  SessionState,
  Vector3Like,
} from "../contracts.js";
import { BlockPlacer } from "./block-placer.js";
import { WalkabilityChecker } from "./walkability-checker.js";
import { createItemChest, createSignPost, createTorchLine } from "./templates/decorations.js";
import { createArch, createFlatPath, createRubblePile, createSimpleHouse, createWallSegment } from "./templates/structures.js";
import { connectPointsWithPath, createAshPatch, createGroundPad } from "./templates/terrain.js";
import { McpAgentBuilder } from "./mcp-agent-builder.js";
import { GeminiDirectBuilder } from "./gemini-direct-builder.js";

const SCENE_BUILDER_PROMPT = `
You are QuizCraft Scene Planner. You convert a historical learning package into a compact Minecraft build plan using a fixed template library.

Your job is not to make a symbolic or generic layout. Your job is to make the world feel lived-in, spatially believable, and visually cinematic while staying playable in Minecraft.

# PRIMARY GOAL
Create a scene that feels dynamic, realistic, and grounded in the source material.
The build should look like a real place shaped by human activity, terrain, time, and events, not a line of evenly spaced props.

# SOURCE FIDELITY (highest priority)
Read "historicalSummary" and "sceneSpec.theme" first.
Every major visual choice must match the historical setting.
Each region's "buildDirectives" tells you what to build there — follow it.
Use "historicalSummary", "sourceExcerpt", region descriptions, and theme to infer:
- architecture style
- density of structures
- level of damage or preservation
- circulation paths
- where landmarks should sit
- how the environment changes from region to region

# REALISM RULES
Design like a believable location, not a toy map.

1. Spatial realism
- Vary region sizes and spacing naturally
- Do not make every region the same shape, scale, or density
- Important landmarks should anchor space and be visible from nearby paths
- Buildings should face paths, plazas, or open space when appropriate
- Use wall segments, arches, rubble, and houses to imply districts, boundaries, courtyards, forums, streets, markets, or ruins

2. Environmental storytelling
- The scene should show cause and effect
- If the theme includes disaster, invasion, decline, eruption, or destruction, later regions should visibly reflect escalation
- Add rubble_pile placements where collapse, damage, debris, or abandonment would naturally occur
- Preserve contrast between intact and damaged spaces
- Make the final region feel climactic

3. Dynamic progression
- The player should feel forward movement through changing environments
- Early regions should introduce the setting
- Middle regions should increase complexity, density, or tension
- Final region should feel visually strongest, most important, or most damaged depending on the topic
- Avoid repetitive copy-paste placement patterns

4. Path realism
- Paths should connect regions logically, like roads or walkways people would actually use
- Slight asymmetry is good
- Regions should branch visually around the path, not all sit in the exact same relative position
- Keep paths foot-traversable and clear, but avoid making the whole scene feel mechanically gridded

# BLOCK PALETTE GUIDANCE
Choose palette blocks that match the setting and mood.

- Roman / Mediterranean city  → palette: ["minecraft:cut_sandstone","minecraft:stone_bricks","minecraft:orange_terracotta","minecraft:quartz_block"]
- Medieval European           → palette: ["minecraft:stone_bricks","minecraft:oak_planks","minecraft:cobblestone","minecraft:dark_oak_log"]
- Ancient Egypt / desert      → palette: ["minecraft:sandstone","minecraft:cut_sandstone","minecraft:chiseled_sandstone","minecraft:smooth_sandstone"]
- Volcanic / disaster scene   → palette: ["minecraft:blackstone","minecraft:basalt","minecraft:cobblestone","minecraft:gray_concrete_powder"]
- Forest / nature             → palette: ["minecraft:moss_block","minecraft:oak_log","minecraft:coarse_dirt","minecraft:cobblestone"]

Prefer palettes that reinforce realism:
- intact civic or sacred zones can use cleaner blocks
- damaged zones can use darker, rougher, or dustier blocks
- do not choose a palette that fights the historical setting

# OUTPUT CONTRACT
Return raw JSON only with these keys:
- theme: string
- palette: string[]  (4 blocks that match the setting above)
- spawnPoint: { x:number, y:number, z:number }
- regionCenters: object keyed by region id with { x:number, y:number, z:number }
- placements: array of { template, origin, size?, palette?, metadata? }
- objectivePlacement: { position, itemName, narrativeLabel }

# LAYOUT CONSTRAINTS
Keep the full scene within a 100x100x100 area around spawn (x/z -50 to 50).
Use itemName from studentObjective.itemName for objectivePlacement.

# LAYOUT RULES
- Regions should generally progress forward through the world, but do not force perfect symmetry
- Typical spacing between successive regions should be about 16-26 blocks, adjusted based on importance
- Connect every adjacent pair of regions with a flat_path
- Place a sign_post at each region center with text from the region description
- Put the item_chest only at the final region
- First region should usually have an arch as an entrance gate or threshold marker
- Disaster or destruction themes should include more rubble_pile placements in later regions than earlier ones
- Use multiple structures in important regions when appropriate by adding more than one placement
- Major regions may include combinations like:
  - arch + wall_segment
  - simple_house + wall_segment
  - simple_house + rubble_pile
  - arch + rubble_pile
- Do not make every region contain the exact same template mix

# PLAYABILITY
- Every region must be reachable on foot from spawn
- No jumps greater than 1 block
- Clear 2-block-wide walking path between regions
- Do not block the main route with structures or rubble
- Keep the objective reachable

# COMPOSITION GUIDANCE
Aim for scenes that feel like real places:
- create sightlines toward major landmarks
- cluster related structures instead of scattering them randomly
- leave some open space for plazas, streets, or courtyards
- use denser placement in important urban areas
- use more emptiness where appropriate for damage, abandonment, or outskirts
- later regions should feel visually transformed if the historical moment involves crisis

# EXAMPLE OF GOOD PLANNING LOGIC
For Pompeii:
- early region could feel like an intact Roman approach
- middle regions could show forum, villas, streets, and civic space
- later regions could show ash, rubble, damage, and looming volcanic impact
- final region should feel climactic and dangerous, not just like another repeated district

Return JSON only. Do not include markdown fences or explanation.
`;


const parseJsonBlock = (value: string): unknown => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : value).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("SceneBuilder: Gemini response did not include a JSON object.");
  }
  return JSON.parse(source.slice(start, end + 1));
};

const makeCenterLine = (experience: ExperiencePackage): Record<string, Vector3Like> => {
  return Object.fromEntries(
    experience.sceneSpec.regions.map((region, index) => [
      region.id,
      {
        x: 0,
        y: 4,
        z: 12 + index * 22,
      },
    ]),
  );
};

const WORLD_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

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

export class SceneBuilder {
  async buildScene(
    bot: Bot,
    session: SessionState,
    apiKey: string | undefined,
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<BuildResult> {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required. Refusing to build with template fallback.");
    }

    console.log("[bot] GeminiDirectBuilder: starting");
    const directResult = await new GeminiDirectBuilder().build(
      bot,
      session.experiencePackage,
      apiKey,
      async (value) => { await onProgress?.(value); },
    );
    console.log("[bot] GeminiDirectBuilder: complete", directResult.buildSummary);
    return directResult;
  }

  private async generateBuildPlan(session: SessionState, apiKey: string | undefined): Promise<BuildPlan> {
    if (apiKey) {
      try {
        return await this.generateWithGemini(session.experiencePackage, apiKey);
      } catch (error) {
        console.warn("[bot] scene plan fallback", error);
      }
    }

    return this.generateFallbackPlan(session.experiencePackage);
  }

  private async generateWithGemini(experience: ExperiencePackage, apiKey: string): Promise<BuildPlan> {
    const client = new GoogleGenerativeAI(apiKey);
    const sourceExcerpt = (experience as unknown as Record<string, unknown>).sourceExcerpt;
    const prompt = [
      SCENE_BUILDER_PROMPT.trim(),
      "",
      ...(sourceExcerpt ? [`Source text (build visuals that match this):\n${String(sourceExcerpt)}`, ""] : []),
      "Experience package:",
      JSON.stringify(experience, null, 2),
    ].join("\n");
    const fallback = this.generateFallbackPlan(experience);
    let lastError: unknown;

    for (const modelName of worldModelCandidates(botConfig.geminiModelWorld)) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(prompt);
        const parsed = parseJsonBlock(result.response.text()) as Partial<BuildPlan>;

        return {
          ...fallback,
          ...parsed,
          clearBounds: parsed.clearBounds ?? fallback.clearBounds,
          spawnPoint: parsed.spawnPoint ?? fallback.spawnPoint,
          palette: Array.isArray(parsed.palette) && parsed.palette.length > 0 ? parsed.palette.map(String) : fallback.palette,
          placements: Array.isArray(parsed.placements) && parsed.placements.length > 0 ? parsed.placements : fallback.placements,
          regionCenters:
            parsed.regionCenters && Object.keys(parsed.regionCenters).length > 0 ? parsed.regionCenters : fallback.regionCenters,
          objectivePlacement: parsed.objectivePlacement ?? fallback.objectivePlacement,
        };
      } catch (error) {
        lastError = error;
        console.warn(`[bot] scene plan model ${modelName} failed`, error);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("SceneBuilder: all world models failed to generate a valid build plan.");
  }

  private generateFallbackPlan(experience: ExperiencePackage): BuildPlan {
    const centers = makeCenterLine(experience);
    const regions = experience.sceneSpec.regions;
    const palette =
      experience.sceneSpec.palette && experience.sceneSpec.palette.length > 0
        ? experience.sceneSpec.palette
        : ["minecraft:stone_bricks", "minecraft:packed_mud", "minecraft:cut_sandstone", "minecraft:tuff"];

    const placements: BuildTemplatePlacement[] = [];

    regions.forEach((region, index) => {
      const center = centers[region.id];
      if (index === 0) {
        placements.push({ template: "arch", origin: { x: center.x - 2, y: center.y, z: center.z - 4 }, palette });
      }

      placements.push({ template: "sign_post", origin: { x: center.x - 2, y: center.y, z: center.z - 1 }, metadata: { text: region.description } });
      placements.push({ template: "torch_line", origin: { x: center.x - 4, y: center.y + 1, z: center.z - 3 } });
      placements.push({ template: "simple_house", origin: { x: center.x + 4, y: center.y, z: center.z - 3 }, palette });
      placements.push({ template: "wall_segment", origin: { x: center.x - 8, y: center.y, z: center.z + 4 }, palette: [palette[0]] });
      placements.push({ template: "rubble_pile", origin: { x: center.x - 5, y: center.y, z: center.z + 2 }, palette: palette.slice(2) });
      if (index < regions.length - 1) {
        placements.push({
          template: "flat_path",
          origin: { x: center.x - 1, y: center.y, z: center.z },
          size: { x: 3, y: 1, z: 18 },
          palette: [palette[1]],
        });
      }
    });

    const finalRegion = regions[regions.length - 1];
    const objectivePlacement = {
      position: {
        x: centers[finalRegion.id].x + 2,
        y: centers[finalRegion.id].y,
        z: centers[finalRegion.id].z + 2,
      },
      itemName: experience.studentObjective.itemName ?? "diamond",
      narrativeLabel: experience.studentObjective.narrativeLabel ?? "artifact",
    };

    placements.push({
      template: "item_chest",
      origin: objectivePlacement.position,
      metadata: {
        itemName: objectivePlacement.itemName,
      },
    });

    return {
      theme: experience.sceneSpec.theme,
      clearBounds: {
        min: { x: -50, y: -64, z: -50 },
        max: { x: 50, y: 100, z: 50 },
      },
      spawnPoint: { x: 0, y: 4, z: 0 },
      palette,
      placements,
      regionCenters: centers,
      objectivePlacement,
    };
  }

  private expandPlacements(buildPlan: BuildPlan, experience: ExperiencePackage) {
    const placements = [
      ...createGroundPad({ x: -50, y: 3, z: -50 }, 101, 101, "minecraft:grass_block"),
      ...createAshPatch({ x: 0, y: 3, z: buildPlan.regionCenters[experience.sceneSpec.regions.at(-1)?.id ?? "climax"]?.z ?? 48 }, 6),
    ];

    const regions = experience.sceneSpec.regions;
    for (let index = 0; index < regions.length - 1; index += 1) {
      const current = buildPlan.regionCenters[regions[index].id];
      const next = buildPlan.regionCenters[regions[index + 1].id];
      placements.push(
        ...connectPointsWithPath(
          { ...current, y: current.y - 1 },
          { ...next, y: next.y - 1 },
          buildPlan.palette[1] ?? "minecraft:packed_mud",
        ),
      );
    }

    for (const placement of buildPlan.placements) {
      const palette = placement.palette ?? buildPlan.palette;
      const origin = {
        ...placement.origin,
        y: placement.origin.y - 1,
      };
      switch (placement.template) {
        case "flat_path":
          placements.push(
            ...createFlatPath(
              origin,
              placement.size?.z ?? 8,
              placement.size?.x ?? 3,
              palette[0] ?? "minecraft:packed_mud",
            ),
          );
          break;
        case "simple_house":
          placements.push(...createSimpleHouse(origin, palette));
          break;
        case "wall_segment":
          placements.push(...createWallSegment(origin, placement.size?.x ?? 8, palette[0] ?? "minecraft:stone_bricks"));
          break;
        case "sign_post":
          placements.push(...createSignPost(origin, String(placement.metadata?.text ?? "Historical clue")));
          break;
        case "torch_line":
          placements.push(...createTorchLine(origin, Number(placement.metadata?.length ?? 5)));
          break;
        case "item_chest":
          placements.push(...createItemChest(origin, String(placement.metadata?.itemName ?? "diamond")));
          break;
        case "arch":
          placements.push(...createArch(origin, palette));
          break;
        case "rubble_pile":
          placements.push(...createRubblePile(origin, palette));
          break;
      }
    }

    return placements;
  }
}
