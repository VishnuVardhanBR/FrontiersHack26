import { BlockPlacement, Vector3Like } from "../../contracts.js";

export const createGroundPad = (origin: Vector3Like, width: number, depth: number, block = "minecraft:grass_block"): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let x = origin.x; x < origin.x + width; x += 1) {
    for (let z = origin.z; z < origin.z + depth; z += 1) {
      placements.push({ x, y: origin.y, z, block });
    }
  }
  return placements;
};

export const connectPointsWithPath = (
  start: Vector3Like,
  end: Vector3Like,
  block = "minecraft:packed_mud",
  width = 3,
): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minZ = Math.min(start.z, end.z);
  const maxZ = Math.max(start.z, end.z);

  for (let x = minX; x <= maxX; x += 1) {
    for (let offset = 0; offset < width; offset += 1) {
      placements.push({ x, y: start.y, z: start.z + offset, block });
    }
  }

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let offset = 0; offset < width; offset += 1) {
      placements.push({ x: end.x + offset, y: start.y, z, block });
    }
  }

  return placements;
};

export const createAshPatch = (origin: Vector3Like, radius = 4): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      if (Math.abs(x) + Math.abs(z) <= radius + 1) {
        placements.push({
          x: origin.x + x,
          y: origin.y,
          z: origin.z + z,
          block: Math.abs(x) + Math.abs(z) > radius - 1 ? "minecraft:gravel" : "minecraft:gray_concrete_powder",
        });
      }
    }
  }
  return placements;
};
