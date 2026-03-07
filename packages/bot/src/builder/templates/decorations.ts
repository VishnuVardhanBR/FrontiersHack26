import { BlockPlacement, Vector3Like } from "../../contracts.js";
import { seededRandom } from "./structures.js";

/* ── sign post ───────────────────────────────────────────────────── */

const signNbt = (text: string): string =>
  `{front_text:{messages:['{"text":"${text.replace(/"/g, "'")}"}','{"text":""}','{"text":""}','{"text":""}']}}`;

const normalizeItemId = (value: string): string => {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/[^a-z0-9_/-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["diamond", "emerald", "gold_ingot", "iron_ingot", "paper", "book", "map", "compass"].includes(raw)) return raw;
  if (/scroll|record|paper|document/.test(raw)) return "paper";
  if (/book|journal|codex/.test(raw)) return "book";
  if (/map|chart/.test(raw)) return "map";
  if (/compass|direction/.test(raw)) return "compass";
  return "diamond";
};

export const createSignPost = (origin: Vector3Like, text: string): BlockPlacement[] => [
  { x: origin.x, y: origin.y,     z: origin.z, block: "minecraft:oak_fence" },
  { x: origin.x, y: origin.y + 1, z: origin.z, block: "minecraft:oak_fence" },
  { x: origin.x, y: origin.y + 2, z: origin.z, block: "minecraft:oak_sign[rotation=8]", nbt: signNbt(text) },
];

/* ── torch_line ──────────────────────────────────────────────────── */

export const createTorchLine = (origin: Vector3Like, length = 5): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  for (let z = 0; z < length; z += 2) {
    out.push({ x: origin.x, y: origin.y, z: origin.z + z, block: "minecraft:oak_fence" });
    out.push({ x: origin.x, y: origin.y + 1, z: origin.z + z, block: "minecraft:oak_fence" });
    out.push({ x: origin.x, y: origin.y + 2, z: origin.z + z, block: "minecraft:torch" });
  }
  return out;
};

/* ── item_chest ──────────────────────────────────────────────────── */

export const createItemChest = (origin: Vector3Like, itemName: string): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Small pedestal
  out.push({ x: ox, y: oy, z: oz, block: "minecraft:stone_brick_stairs[facing=south,half=bottom]" });
  out.push({ x: ox, y: oy, z: oz + 2, block: "minecraft:stone_brick_stairs[facing=north,half=bottom]" });
  out.push({ x: ox - 1, y: oy, z: oz + 1, block: "minecraft:stone_brick_stairs[facing=east,half=bottom]" });
  out.push({ x: ox + 1, y: oy, z: oz + 1, block: "minecraft:stone_brick_stairs[facing=west,half=bottom]" });
  out.push({ x: ox, y: oy, z: oz + 1, block: "minecraft:chiseled_stone_bricks" });

  // Chest on pedestal
  out.push({
    x: ox,
    y: oy + 1,
    z: oz + 1,
    block: "minecraft:chest[facing=south]",
    nbt: `{CustomName:'{"text":"Artifact Chest"}',Items:[{Slot:13b,id:"minecraft:${normalizeItemId(itemName)}",Count:1b}]}`,
  });

  // Torches flanking
  out.push({ x: ox - 1, y: oy + 1, z: oz + 1, block: "minecraft:torch" });
  out.push({ x: ox + 1, y: oy + 1, z: oz + 1, block: "minecraft:torch" });

  return out;
};

/* ── street_lamp ─────────────────────────────────────────────────── */

export const createStreetLamp = (origin: Vector3Like): BlockPlacement[] => {
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  return [
    { x: ox, y: oy,     z: oz, block: "minecraft:cobblestone_wall" },
    { x: ox, y: oy + 1, z: oz, block: "minecraft:cobblestone_wall" },
    { x: ox, y: oy + 2, z: oz, block: "minecraft:cobblestone_wall" },
    { x: ox, y: oy + 3, z: oz, block: "minecraft:lantern" },
  ];
};

/* ── bench ───────────────────────────────────────────────────────── */

export const createBench = (
  origin: Vector3Like,
  facing: "north" | "south" | "east" | "west" = "south",
): BlockPlacement[] => {
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const isXAxis = facing === "north" || facing === "south";

  if (isXAxis) {
    return [
      { x: ox,     y: oy, z: oz, block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
      { x: ox + 1, y: oy, z: oz, block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
      { x: ox + 2, y: oy, z: oz, block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
    ];
  }
  return [
    { x: ox, y: oy, z: oz,     block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
    { x: ox, y: oy, z: oz + 1, block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
    { x: ox, y: oy, z: oz + 2, block: `minecraft:oak_stairs[facing=${facing},half=bottom]` },
  ];
};

/* ── oak_tree ────────────────────────────────────────────────────── */

export const createOakTree = (origin: Vector3Like): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Trunk (4-5 blocks tall)
  const trunkHeight = 4 + (seededRandom(ox, oz) > 0.5 ? 1 : 0);
  for (let y = 0; y < trunkHeight; y += 1) {
    out.push({ x: ox, y: oy + y, z: oz, block: "minecraft:oak_log" });
  }

  // Canopy layers
  const canopyBase = oy + trunkHeight - 1;

  // Bottom layer (5x5 minus corners)
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // skip corners
      if (dx === 0 && dz === 0) continue; // trunk is here
      out.push({ x: ox + dx, y: canopyBase, z: oz + dz, block: "minecraft:oak_leaves[persistent=true]" });
    }
  }

  // Middle layer (5x5 minus corners)
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      out.push({ x: ox + dx, y: canopyBase + 1, z: oz + dz, block: "minecraft:oak_leaves[persistent=true]" });
    }
  }

  // Top layer (3x3 plus shape)
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      out.push({ x: ox + dx, y: canopyBase + 2, z: oz + dz, block: "minecraft:oak_leaves[persistent=true]" });
    }
  }

  // Peak
  out.push({ x: ox, y: canopyBase + 3, z: oz, block: "minecraft:oak_leaves[persistent=true]" });

  return out;
};

/* ── flower_patch ────────────────────────────────────────────────── */

const FLOWERS = [
  "minecraft:poppy",
  "minecraft:dandelion",
  "minecraft:cornflower",
  "minecraft:oxeye_daisy",
  "minecraft:azure_bluet",
  "minecraft:allium",
];

export const createFlowerPatch = (
  origin: Vector3Like,
  radius = 2,
): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
      const r = seededRandom(origin.x + dx, origin.z + dz);
      if (r > 0.5) {
        const flower = FLOWERS[Math.floor(seededRandom(origin.x + dx + 3, origin.z + dz + 7) * FLOWERS.length)];
        out.push({ x: origin.x + dx, y: origin.y, z: origin.z + dz, block: flower });
      }
    }
  }
  return out;
};

/* ── grass_cluster ───────────────────────────────────────────────── */

export const createGrassCluster = (
  origin: Vector3Like,
  radius = 3,
): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const plants = ["minecraft:short_grass", "minecraft:fern", "minecraft:short_grass"];
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      if (Math.abs(dx) + Math.abs(dz) > radius) continue;
      const r = seededRandom(origin.x + dx + 11, origin.z + dz + 13);
      if (r > 0.55) {
        const plant = plants[Math.floor(r * plants.length)];
        out.push({ x: origin.x + dx, y: origin.y, z: origin.z + dz, block: plant });
      }
    }
  }
  return out;
};

/* ── barrel_stack ────────────────────────────────────────────────── */

export const createBarrelStack = (origin: Vector3Like): BlockPlacement[] => [
  { x: origin.x,     y: origin.y,     z: origin.z,     block: "minecraft:barrel[facing=up]" },
  { x: origin.x + 1, y: origin.y,     z: origin.z,     block: "minecraft:barrel[facing=up]" },
  { x: origin.x,     y: origin.y,     z: origin.z + 1, block: "minecraft:barrel[facing=east]" },
  { x: origin.x,     y: origin.y + 1, z: origin.z,     block: "minecraft:barrel[facing=up]" },
];

/* ── well ────────────────────────────────────────────────────────── */

export const createWell = (origin: Vector3Like): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Stone ring
  for (const [dx, dz] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    out.push({ x: ox + dx, y: oy, z: oz + dz, block: "minecraft:cobblestone_wall" });
  }
  // Water
  out.push({ x: ox, y: oy - 1, z: oz, block: "minecraft:water" });

  // Roof posts
  out.push({ x: ox - 1, y: oy + 1, z: oz - 1, block: "minecraft:oak_fence" });
  out.push({ x: ox - 1, y: oy + 2, z: oz - 1, block: "minecraft:oak_fence" });
  out.push({ x: ox + 1, y: oy + 1, z: oz + 1, block: "minecraft:oak_fence" });
  out.push({ x: ox + 1, y: oy + 2, z: oz + 1, block: "minecraft:oak_fence" });

  // Roof beam
  out.push({ x: ox - 1, y: oy + 3, z: oz - 1, block: "minecraft:oak_slab[type=bottom]" });
  out.push({ x: ox,     y: oy + 3, z: oz,     block: "minecraft:oak_planks" });
  out.push({ x: ox + 1, y: oy + 3, z: oz + 1, block: "minecraft:oak_slab[type=bottom]" });

  return out;
};
