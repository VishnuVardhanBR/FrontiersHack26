import type { Bot } from "mineflayer";
import { GoogleGenerativeAI } from "@google/generative-ai";

import {
  BuildPlan,
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

const SCENE_BUILDER_PROMPT = `
You are QuizCraft Scene Planner. You are running as an agent inside a local Minecraft tutoring app.
You are an expert in historical storytelling, visual 3D design, and playable Minecraft layout planning.

# General
- You convert one historical learning package into a compact Minecraft build plan.
- You do not write Python code or raw block-by-block commands.
- You return raw JSON only for QuizCraft's template-based builder.
- The student will walk through this world with a Minecraft character while a tutor bot narrates and asks questions.
- It is critical that the scene be visually readable, historically evocative, compact, and fully traversable.

# Output Contract
Return raw JSON only with these keys:
- theme: string
- palette: string[]
- spawnPoint: { x:number, y:number, z:number }
- regionCenters: object keyed by region id with { x:number, y:number, z:number }
- placements: array of { template, origin, size?, palette?, metadata? }
- objectivePlacement: { position, itemName, narrativeLabel }

Only use these templates:
- flat_path
- simple_house
- wall_segment
- sign_post
- torch_line
- item_chest
- arch
- rubble_pile

Keep the full scene within a 100x100x100 area around spawn.
Prefer valid Minecraft item ids for objectivePlacement.itemName, such as paper, book, map, compass, diamond, emerald, or gold_ingot.

# Build Categories
Before planning, decide which category the learning package most closely matches:

## Category A: Symbolic Landmark Vignette
- Use when a region is mainly a memorable icon, monument, gate, ruin fragment, or focal prop
- Focus on strong silhouette and immediate readability
- Do not overbuild empty surroundings

## Category B: Structure In Context
- Use when the package implies homes, markets, villas, forums, bridges, streets, or other built spaces
- The structure should sit inside a readable environment with paths, walls, props, and approach routes
- The student should understand how people might have used the space

## Category C: Narrative Walkthrough Scene
- Use when the package is about moving through multiple historical beats
- Build the scene as a guided sequence: arrival, context, tension, climax, recap
- Each region should communicate one distinct teaching moment

# Playability Requirements
For this project, you are not making a static model. You are creating a playable teaching space.

## Core Accessibility Rules
- Every region center must be reachable on foot from spawn
- Prefer straight, obvious routes over maze-like layouts
- Paths should feel intentional and safe, not decorative only
- Avoid jumps taller than 1 block in the intended student route
- Keep open walking space around landmarks so the tutor bot can escort the player comfortably
- If a platform or overlook exists, include a clear way up and down

## Stair and Elevation Guidance
- Default to straight Minecraft stairs when vertical movement is needed
- Use gentle 1-block rises, stairs, or short ramps
- Avoid spiral stairs unless the space is extremely tight
- Elevated areas should exist only if the player can reach them naturally

## Terrain Playability
- Use gradual slopes, short rises, and clear paths
- Do not trap the player behind rubble, walls, or decorative clutter
- If ash, debris, or ruins are part of the theme, keep the teaching route clear through them

# Structural Design Principles
## Physical Connectivity
- Every planned structure or prop cluster must feel anchored to the scene
- No floating pieces with no visible support
- Use walls, arches, paths, and rubble to connect regions into one cohesive route

## Material Variety
- Never rely on a single block family for the whole scene
- Use contrast between foundations, pathing, trim, ruins, and focal landmarks
- Keep the palette compact, but not monotonous

## Defining Features
- Each region should have one dominant visual cue that matches the lesson content
- Use signs, arches, wall fragments, houses, and rubble to imply history without needing a giant build
- Favor symbolic clarity over massive realism

# Educational Scene Rules
- The full scene should support a 5 to 7 minute guided lesson
- Use 3 to 5 regions and make each one visually distinct
- Reserve the final region for the objective item chest
- Make the first region legible from spawn so the student immediately knows where to go
- Reinforce the chapter's main facts through environmental storytelling
- If the package mentions a disaster, battle, or transformation, reflect that progression visually across the route

# Common Mistakes To Avoid
- Oversized cities that dilute the lesson
- Empty plazas with no focal teaching landmark
- Decorative routes that are not clearly walkable
- Repeating the same structure in every region
- Hiding the objective chest in a frustrating or inaccessible location
- Planning details that require templates or geometry not supported by the allowed template list

Return JSON only. Do not include markdown fences or explanation.
`;

const parseJsonBlock = (value: string): unknown => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : value;
  return JSON.parse(source);
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

export interface BuildResult {
  buildPlan: BuildPlan;
  buildSummary: {
    commandCount: number;
    fillCount: number;
    setblockCount: number;
    walkabilityPassed: boolean;
  };
}

export class SceneBuilder {
  async buildScene(
    bot: Bot,
    session: SessionState,
    apiKey: string | undefined,
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<BuildResult> {
    const buildPlan = await this.generateBuildPlan(session, apiKey);
    const placer = new BlockPlacer(bot);

    await onProgress?.(0.05);
    await placer.clearArea(buildPlan.clearBounds.min, buildPlan.clearBounds.max);

    const placements = this.expandPlacements(buildPlan, session.experiencePackage);
    const stats = await placer.placeBlocks(placements, async (value) => {
      await onProgress?.(0.05 + value * 0.85);
    });

    const walkabilityPassed = await new WalkabilityChecker(bot).verify(Object.values(buildPlan.regionCenters));
    await onProgress?.(1);

    return {
      buildPlan,
      buildSummary: {
        ...stats,
        walkabilityPassed,
      },
    };
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
    const model = client.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const prompt = [
      SCENE_BUILDER_PROMPT.trim(),
      "",
      "Experience package:",
      JSON.stringify(experience, null, 2),
    ].join("\n");

    const result = await model.generateContent(prompt);
    const parsed = parseJsonBlock(result.response.text()) as Partial<BuildPlan>;
    const fallback = this.generateFallbackPlan(experience);

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
