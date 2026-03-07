import { z } from "zod";

const Vec3Schema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
});

export const TemplatePlacementSchema = z.object({
  id: z.string().min(1),
  templateId: z.enum([
    "flat_path",
    "simple_house",
    "wall_segment",
    "sign_post",
    "torch_line",
    "item_chest",
    "arch",
    "rubble_pile",
  ]),
  anchor: Vec3Schema,
  size: z.object({
    width: z.number().int().positive().default(5),
    height: z.number().int().positive().default(4),
    depth: z.number().int().positive().default(5),
  }),
  facing: z.enum(["north", "south", "east", "west"]).default("north"),
  palette: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).default([]),
});

export const RegionBuildSchema = z.object({
  regionId: z.string().min(1),
  center: Vec3Schema,
  narrationFocus: z.string().min(1),
  placements: z.array(TemplatePlacementSchema).min(1),
});

export const BuildPlanSchema = z.object({
  buildId: z.string().min(1),
  sessionId: z.string().min(1),
  theme: z.string().min(1),
  cleanupArea: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
  }),
  spawnPoint: Vec3Schema,
  palette: z.array(z.string().min(1)).min(1),
  terrainDirectives: z.array(z.string().min(1)).min(1),
  regions: z.array(RegionBuildSchema).min(3).max(5),
  walkablePaths: z.array(
    z.object({
      fromRegionId: z.string().min(1),
      toRegionId: z.string().min(1),
      waypoints: z.array(Vec3Schema).min(2),
    }),
  ).default([]),
  objectivePlacement: z.object({
    item: z.string().min(1),
    chestPosition: Vec3Schema,
    hint: z.string().min(1),
  }),
});

export type BuildPlan = z.infer<typeof BuildPlanSchema>;
export type RegionBuild = z.infer<typeof RegionBuildSchema>;
export type TemplatePlacement = z.infer<typeof TemplatePlacementSchema>;
