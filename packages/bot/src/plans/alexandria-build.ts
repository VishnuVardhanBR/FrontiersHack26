import { BuildPlan } from "../contracts.js";

const Y = 8;

/** Experience id for the hardcoded Library of Alexandria demo. Must match shared package. */
export const LIBRARY_ALEXANDRIA_EXPERIENCE_ID = "library_alexandria_demo";

export const ALEXANDRIA_REGION_CENTERS: Record<string, { x: number; y: number; z: number }> = {
  entry_foyer: { x: 1, y: Y, z: 2 },
  main_stacks: { x: 0, y: Y, z: 8 },
  restoration_nook: { x: 2, y: Y, z: 14 },
  knowledge_chamber: { x: 1, y: Y, z: 24 },
};

export function getAlexandriaBuildPlan(): BuildPlan {
  return {
    theme: "ancient library, preserved knowledge",
    clearBounds: {
      min: { x: -15, y: 0, z: -5 },
      max: { x: 15, y: 16, z: 35 },
    },
    spawnPoint: { x: 0, y: Y, z: 0 },
    tutorSpawn: { x: 2, y: Y, z: 0 },
    palette: [
      "minecraft:stone_bricks",
      "minecraft:chiseled_stone_bricks",
      "minecraft:bookshelf",
      "minecraft:smooth_stone",
    ],
    placements: [],
    regionCenters: ALEXANDRIA_REGION_CENTERS,
    objectivePlacement: {
      position: { x: 0, y: Y + 1, z: 15 },
      itemName: "paper",
      narrativeLabel: "scroll",
    },
  };
}

