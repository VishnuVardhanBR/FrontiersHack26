import { BlockPlacement, Vector3Like } from "../../contracts.js";

const pushCuboid = (placements: BlockPlacement[], min: Vector3Like, max: Vector3Like, block: string) => {
  for (let x = min.x; x <= max.x; x += 1) {
    for (let y = min.y; y <= max.y; y += 1) {
      for (let z = min.z; z <= max.z; z += 1) {
        placements.push({ x, y, z, block });
      }
    }
  }
};

export const createFlatPath = (origin: Vector3Like, length = 8, width = 3, block = "minecraft:packed_mud"): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let z = origin.z; z < origin.z + length; z += 1) {
    for (let x = origin.x; x < origin.x + width; x += 1) {
      placements.push({ x, y: origin.y, z, block });
    }
  }
  return placements;
};

export const createSimpleHouse = (origin: Vector3Like, palette: string[]): BlockPlacement[] => {
  const wall = palette[0] ?? "minecraft:stone_bricks";
  const roof = palette[1] ?? "minecraft:oak_planks";
  const trim = palette[2] ?? "minecraft:spruce_log";
  const air = "minecraft:air";
  const placements: BlockPlacement[] = [];

  pushCuboid(placements, origin, { x: origin.x + 4, y: origin.y + 3, z: origin.z + 5 }, wall);
  pushCuboid(placements, { x: origin.x + 1, y: origin.y + 1, z: origin.z + 1 }, { x: origin.x + 3, y: origin.y + 2, z: origin.z + 4 }, air);
  pushCuboid(placements, { x: origin.x, y: origin.y + 4, z: origin.z }, { x: origin.x + 4, y: origin.y + 4, z: origin.z + 5 }, roof);

  for (let y = origin.y; y <= origin.y + 4; y += 1) {
    placements.push({ x: origin.x, y, z: origin.z, block: trim });
    placements.push({ x: origin.x + 4, y, z: origin.z, block: trim });
    placements.push({ x: origin.x, y, z: origin.z + 5, block: trim });
    placements.push({ x: origin.x + 4, y, z: origin.z + 5, block: trim });
  }

  placements.push({ x: origin.x + 2, y: origin.y + 1, z: origin.z, block: air });
  placements.push({ x: origin.x + 2, y: origin.y + 2, z: origin.z, block: air });
  placements.push({ x: origin.x + 2, y: origin.y + 1, z: origin.z, block: "minecraft:oak_door[half=lower,facing=south]" });
  placements.push({ x: origin.x + 2, y: origin.y + 2, z: origin.z, block: "minecraft:oak_door[half=upper,facing=south]" });
  placements.push({ x: origin.x + 1, y: origin.y + 2, z: origin.z + 5, block: "minecraft:glass_pane" });
  placements.push({ x: origin.x + 3, y: origin.y + 2, z: origin.z + 5, block: "minecraft:glass_pane" });

  return placements;
};

export const createWallSegment = (origin: Vector3Like, length = 8, block = "minecraft:stone_bricks"): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let x = origin.x; x < origin.x + length; x += 1) {
    for (let y = origin.y; y < origin.y + 3; y += 1) {
      placements.push({ x, y, z: origin.z, block });
    }
  }
  return placements;
};

export const createArch = (origin: Vector3Like, palette: string[]): BlockPlacement[] => {
  const block = palette[0] ?? "minecraft:cut_sandstone";
  const placements: BlockPlacement[] = [];
  pushCuboid(placements, { x: origin.x, y: origin.y, z: origin.z }, { x: origin.x, y: origin.y + 3, z: origin.z }, block);
  pushCuboid(placements, { x: origin.x + 4, y: origin.y, z: origin.z }, { x: origin.x + 4, y: origin.y + 3, z: origin.z }, block);
  pushCuboid(placements, { x: origin.x, y: origin.y + 3, z: origin.z }, { x: origin.x + 4, y: origin.y + 4, z: origin.z }, block);
  pushCuboid(placements, { x: origin.x + 1, y: origin.y + 1, z: origin.z }, { x: origin.x + 3, y: origin.y + 2, z: origin.z }, "minecraft:air");
  return placements;
};

export const createRubblePile = (origin: Vector3Like, palette: string[]): BlockPlacement[] => {
  const base = palette[0] ?? "minecraft:cobblestone";
  const detail = palette[1] ?? "minecraft:tuff";
  return [
    { x: origin.x, y: origin.y, z: origin.z, block: base },
    { x: origin.x + 1, y: origin.y, z: origin.z, block: detail },
    { x: origin.x, y: origin.y, z: origin.z + 1, block: detail },
    { x: origin.x + 1, y: origin.y, z: origin.z + 1, block: base },
    { x: origin.x, y: origin.y + 1, z: origin.z, block: base },
  ];
};
