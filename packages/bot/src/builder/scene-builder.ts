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
You plan compact Minecraft educational scenes from historical learning packages.
Return raw JSON only with these keys:
- theme: string
- palette: string[]
- spawnPoint: { x:number, y:number, z:number }
- regionCenters: object keyed by region id with { x:number, y:number, z:number }
- placements: array of { template, origin, size?, palette?, metadata? }
- objectivePlacement: { position, itemName, narrativeLabel }
Keep the scene within a 100x100x100 area and use only these templates:
flat_path, simple_house, wall_segment, sign_post, torch_line, item_chest, arch, rubble_pile
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
