/**
 * Hardcoded block placements for the Lost Library of Alexandria demo.
 * Base Y=8; path roughly X ±2, Z -2..28. Pedestal at (0,9,15) left empty for scroll.
 */

import { BlockPlacement, Vector3Like } from "../contracts.js";
import { createItemChest, createSignPost, createTorchLine } from "../builder/templates/decorations.js";
import { createSpawnPortal } from "../builder/templates/structures.js";

const pushCuboid = (out: BlockPlacement[], min: Vector3Like, max: Vector3Like, block: string) => {
  for (let x = min.x; x <= max.x; x += 1) {
    for (let y = min.y; y <= max.y; y += 1) {
      for (let z = min.z; z <= max.z; z += 1) {
        out.push({ x, y, z, block });
      }
    }
  }
};

const Y = 8;
const Y_BELOW = 7;

/** Pedestal top block — player places scroll here. Left as air in initial build. */
export const PEDESTAL_TOP = { x: 0, y: Y + 1, z: 15 };
/** Chest with scroll (paper). */
export const SCROLL_CHEST = { x: -3, y: Y, z: 15 };
/** Seal door: we remove these blocks when puzzle is solved. */
export const SEAL_DOOR_MIN = { x: -2, y: Y, z: 20 };
export const SEAL_DOOR_MAX = { x: 2, y: Y + 3, z: 20 };
/** Chamber glow positions (place glowstone/lantern on solve). */
export const CHAMBER_GLOW = [
  { x: 0, y: Y + 1, z: 24 },
  { x: -2, y: Y + 1, z: 22 },
  { x: 2, y: Y + 1, z: 22 },
  { x: -1, y: Y + 1, z: 26 },
  { x: 1, y: Y + 1, z: 26 },
];

export function getAlexandriaPlacements(): BlockPlacement[] {
  const placements: BlockPlacement[] = [];

  // Support layer under path
  for (let z = -2; z <= 28; z += 1) {
    for (let x = -3; x <= 3; x += 1) {
      placements.push({ x, y: Y_BELOW, z, block: "minecraft:stone_bricks" });
    }
  }

  // Path floor Y=8 (skip player spawn and tutor spawn so they stay passable)
  const spawnSkip = new Set(["0,8,0", "2,8,0"]);
  for (let z = -1; z <= 28; z += 1) {
    for (let x = -2; x <= 2; x += 1) {
      if (spawnSkip.has(`${x},${Y},${z}`)) continue;
      placements.push({ x, y: Y, z, block: "minecraft:stone_bricks" });
    }
  }

  // Entry: spawn portal at (0,8,0) — keeps (0,9,0) and (0,10,0) air for portal
  placements.push(...createSpawnPortal({ x: 0, y: Y, z: 0 }));

  // Entry columns (pillars)
  pushCuboid(placements, { x: -4, y: Y, z: 1 }, { x: -4, y: Y + 3, z: 1 }, "minecraft:chiseled_stone_bricks");
  pushCuboid(placements, { x: 4, y: Y, z: 1 }, { x: 4, y: Y + 3, z: 1 }, "minecraft:chiseled_stone_bricks");
  pushCuboid(placements, { x: -4, y: Y, z: 3 }, { x: -4, y: Y + 3, z: 3 }, "minecraft:chiseled_stone_bricks");
  pushCuboid(placements, { x: 4, y: Y, z: 3 }, { x: 4, y: Y + 3, z: 3 }, "minecraft:chiseled_stone_bricks");

  // Intro sign (multi-line so it renders clearly)
  placements.push(
    ...createSignPost(
      { x: 1, y: Y, z: 2 },
      "Lost Library\nRestore the scroll on the\npedestal ahead to open\nthe archive.",
    ),
  );

  // Torches along path
  placements.push(...createTorchLine({ x: -2, y: Y + 1, z: 4 }, 12));
  placements.push(...createTorchLine({ x: 2, y: Y + 1, z: 6 }, 10));

  // Main stacks: bookshelves
  pushCuboid(placements, { x: -4, y: Y, z: 6 }, { x: -3, y: Y + 2, z: 10 }, "minecraft:bookshelf");
  pushCuboid(placements, { x: 3, y: Y, z: 6 }, { x: 4, y: Y + 2, z: 10 }, "minecraft:bookshelf");
  // Lecterns
  placements.push({ x: -1, y: Y, z: 8, block: "minecraft:lectern[facing=south]" });
  placements.push({ x: 1, y: Y, z: 8, block: "minecraft:lectern[facing=south]" });

  // Restoration nook: redstone pedestal — observer detects block placed on top
  placements.push({ x: 0, y: Y_BELOW, z: 15, block: "minecraft:stone_bricks" });
  placements.push({ x: 1, y: Y_BELOW, z: 15, block: "minecraft:redstone_lamp" });
  placements.push({ x: -1, y: Y_BELOW, z: 15, block: "minecraft:redstone_lamp" });
  placements.push({ x: 0, y: Y, z: 15, block: "minecraft:observer[facing=up]" });
  // (0, Y+1, 15) air — player places any block here (paper can't be placed; use stone/planks)

  // Pedestal marker: lanterns on both sides so it’s easy to spot
  placements.push({ x: -1, y: Y + 1, z: 15, block: "minecraft:lantern[hanging=false]" });
  placements.push({ x: 1, y: Y + 1, z: 15, block: "minecraft:lantern[hanging=false]" });
  // Sign next to pedestal (paper can't be placed; use any block)
  placements.push(
    ...createSignPost(
      { x: 2, y: Y, z: 15 },
      "Archive pedestal\nPlace any block here\n(stone, planks)\nto open the door",
    ),
  );

  // Chest with paper (scroll) — clear label so players see “Take the scroll”
  placements.push(...createItemChest(SCROLL_CHEST, "paper", "Take the scroll"));

  // Seal door (wall at z=20)
  pushCuboid(placements, SEAL_DOOR_MIN, SEAL_DOOR_MAX, "minecraft:stone_bricks");

  // Chamber floor
  for (let z = 21; z <= 27; z += 1) {
    for (let x = -2; x <= 2; x += 1) {
      placements.push({ x, y: Y, z, block: "minecraft:smooth_stone" });
    }
  }
  // Chamber plinth
  pushCuboid(placements, { x: 0, y: Y, z: 24 }, { x: 0, y: Y + 1, z: 24 }, "minecraft:chiseled_stone_bricks");

  return placements;
}
