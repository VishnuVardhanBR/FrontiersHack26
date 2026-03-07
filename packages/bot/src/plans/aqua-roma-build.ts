/**
 * Hardcoded BuildPlan for Aqua Roma demo (bot shape).
 * Use when building the Aqua Roma scene without Gemini.
 * Scene is ~35×35 blocks; 5 regions in a line. See docs/AQUA_ROMA_SPEC.md.
 */

import type { BuildPlan } from "../contracts.js";

const SPAWN = { x: 0, y: 4, z: 0 };
const REGION_Z_STEP = 12;

const regionCenters: Record<string, { x: number; y: number; z: number }> = {
  spawn_courtyard: { ...SPAWN },
  arch: { x: 0, y: 4, z: SPAWN.z + REGION_Z_STEP },
  channel: { x: 0, y: 4, z: SPAWN.z + REGION_Z_STEP * 2 },
  city_basin: { x: 0, y: 4, z: SPAWN.z + REGION_Z_STEP * 3 },
  maintenance: { x: 0, y: 4, z: SPAWN.z + REGION_Z_STEP * 4 },
};

const palette = [
  "minecraft:stone_bricks",
  "minecraft:chiseled_stone_bricks",
  "minecraft:stone_brick_slab",
  "minecraft:water",
  "minecraft:lantern",
];

export const AQUA_ROMA_BUILD_PLAN: BuildPlan = {
  theme: "Roman aqueduct",
  clearBounds: {
    min: { x: -25, y: -64, z: -5 },
    max: { x: 25, y: 100, z: 55 },
  },
  spawnPoint: SPAWN,
  palette,
  regionCenters,
  placements: [
    // Spawn courtyard — signs, flat path
    {
      template: "sign_post",
      origin: { x: SPAWN.x - 2, y: SPAWN.y, z: SPAWN.z - 1 },
      metadata: { text: "Aqua Roma — Follow the guide" },
    },
    {
      template: "flat_path",
      origin: { x: SPAWN.x - 1, y: SPAWN.y, z: SPAWN.z },
      size: { x: 3, y: 1, z: REGION_Z_STEP },
      palette: [palette[1]],
    },
    // Arch region
    {
      template: "arch",
      origin: {
        x: regionCenters.arch.x - 2,
        y: regionCenters.arch.y,
        z: regionCenters.arch.z - 4,
      },
      palette,
    },
    {
      template: "sign_post",
      origin: { x: regionCenters.arch.x - 2, y: regionCenters.arch.y, z: regionCenters.arch.z - 1 },
      metadata: { text: "Arches support the channel" },
    },
    {
      template: "flat_path",
      origin: { x: regionCenters.arch.x - 1, y: regionCenters.arch.y, z: regionCenters.arch.z },
      size: { x: 3, y: 1, z: REGION_Z_STEP },
      palette: [palette[1]],
    },
    // Channel region — wall segment as channel, torch line
    {
      template: "wall_segment",
      origin: {
        x: regionCenters.channel.x - 4,
        y: regionCenters.channel.y,
        z: regionCenters.channel.z - 2,
      },
      size: { x: 8, y: 2, z: 4 },
      palette: [palette[0]],
    },
    {
      template: "sign_post",
      origin: { x: regionCenters.channel.x + 2, y: regionCenters.channel.y, z: regionCenters.channel.z - 1 },
      metadata: { text: "Water flows downhill — slight slope" },
    },
    {
      template: "torch_line",
      origin: { x: regionCenters.channel.x - 3, y: regionCenters.channel.y + 1, z: regionCenters.channel.z },
      metadata: { length: "4" },
    },
    {
      template: "flat_path",
      origin: { x: regionCenters.channel.x - 1, y: regionCenters.channel.y, z: regionCenters.channel.z },
      size: { x: 3, y: 1, z: REGION_Z_STEP },
      palette: [palette[1]],
    },
    // City basin — focal point
    {
      template: "rubble_pile",
      origin: { x: regionCenters.city_basin.x - 3, y: regionCenters.city_basin.y, z: regionCenters.city_basin.z },
      palette: palette.slice(0, 2),
    },
    {
      template: "sign_post",
      origin: { x: regionCenters.city_basin.x + 2, y: regionCenters.city_basin.y, z: regionCenters.city_basin.z - 1 },
      metadata: { text: "City delivery — baths, fountains" },
    },
    {
      template: "flat_path",
      origin: { x: regionCenters.city_basin.x - 1, y: regionCenters.city_basin.y, z: regionCenters.city_basin.z },
      size: { x: 3, y: 1, z: REGION_Z_STEP },
      palette: [palette[1]],
    },
    // Maintenance — lever area; objective "chest" at basin for compatibility
    {
      template: "wall_segment",
      origin: {
        x: regionCenters.maintenance.x - 2,
        y: regionCenters.maintenance.y,
        z: regionCenters.maintenance.z - 2,
      },
      size: { x: 4, y: 2, z: 2 },
      palette: [palette[0]],
    },
    {
      template: "sign_post",
      origin: { x: regionCenters.maintenance.x + 2, y: regionCenters.maintenance.y, z: regionCenters.maintenance.z - 1 },
      metadata: { text: "Restore the water — lever or block" },
    },
    // Chest at basin (objective marker; puzzle completion can be wired later)
    {
      template: "item_chest",
      origin: {
        x: regionCenters.city_basin.x + 2,
        y: regionCenters.city_basin.y,
        z: regionCenters.city_basin.z + 2,
      },
      metadata: { itemName: "water_bucket" },
    },
  ],
  objectivePlacement: {
    position: {
      x: regionCenters.city_basin.x + 2,
      y: regionCenters.city_basin.y,
      z: regionCenters.city_basin.z + 2,
    },
    itemName: "water_bucket",
    narrativeLabel: "restored water",
  },
};
