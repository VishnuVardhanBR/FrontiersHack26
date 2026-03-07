import { BlockPlacement, Vector3Like } from "../../contracts.js";

/* ── helpers ─────────────────────────────────────────────────────── */

const pushCuboid = (
  out: BlockPlacement[],
  min: Vector3Like,
  max: Vector3Like,
  block: string,
) => {
  for (let x = min.x; x <= max.x; x += 1)
    for (let y = min.y; y <= max.y; y += 1)
      for (let z = min.z; z <= max.z; z += 1)
        out.push({ x, y, z, block });
};

const pushHollowCuboid = (
  out: BlockPlacement[],
  min: Vector3Like,
  max: Vector3Like,
  block: string,
) => {
  for (let x = min.x; x <= max.x; x += 1)
    for (let y = min.y; y <= max.y; y += 1)
      for (let z = min.z; z <= max.z; z += 1) {
        const onEdge =
          x === min.x || x === max.x ||
          y === min.y || y === max.y ||
          z === min.z || z === max.z;
        if (onEdge) out.push({ x, y, z, block });
      }
};

const seededRandom = (x: number, z: number) => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/* ── flat_path ───────────────────────────────────────────────────── */

export const createFlatPath = (
  origin: Vector3Like,
  length = 8,
  width = 3,
  block = "minecraft:stone_bricks",
): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const edgeBlock = "minecraft:stone_brick_slab[type=bottom]";

  for (let z = origin.z; z < origin.z + length; z += 1) {
    for (let x = origin.x; x < origin.x + width; x += 1) {
      // sub-surface layer
      out.push({ x, y: origin.y - 1, z, block: "minecraft:cobblestone" });
      // surface
      const isEdge = x === origin.x || x === origin.x + width - 1;
      out.push({ x, y: origin.y, z, block: isEdge ? edgeBlock : block });
    }
  }
  return out;
};

/* ── simple_house ────────────────────────────────────────────────── */

export const createSimpleHouse = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const wall  = palette[0] ?? "minecraft:stone_bricks";
  const roof  = palette[1] ?? "minecraft:oak_planks";
  const trim  = palette[2] ?? "minecraft:stripped_oak_log";
  const floor = palette[3] ?? "minecraft:oak_planks";
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const out: BlockPlacement[] = [];

  // Foundation (7 wide x 8 deep)
  pushCuboid(out, { x: ox, y: oy - 1, z: oz }, { x: ox + 6, y: oy - 1, z: oz + 7 }, "minecraft:cobblestone");

  // Floor
  pushCuboid(out, { x: ox, y: oy, z: oz }, { x: ox + 6, y: oy, z: oz + 7 }, floor);

  // Walls (4 high)
  pushHollowCuboid(out, { x: ox, y: oy + 1, z: oz }, { x: ox + 6, y: oy + 4, z: oz + 7 }, wall);

  // Clear interior
  pushCuboid(out, { x: ox + 1, y: oy + 1, z: oz + 1 }, { x: ox + 5, y: oy + 3, z: oz + 6 }, "minecraft:air");

  // Corner posts (floor to roof)
  for (const cx of [ox, ox + 6])
    for (const cz of [oz, oz + 7])
      pushCuboid(out, { x: cx, y: oy, z: cz }, { x: cx, y: oy + 5, z: cz }, trim);

  // Roof — peaked along x-axis
  for (let step = 0; step <= 3; step += 1) {
    const roofY = oy + 5 + step;
    const indent = step;
    if (ox + indent > ox + 6 - indent) break;
    pushCuboid(out,
      { x: ox + indent, y: roofY, z: oz - 1 },
      { x: ox + 6 - indent, y: roofY, z: oz + 8 },
      step === 3 ? trim : roof,
    );
  }

  // Door (south face, centered)
  out.push({ x: ox + 3, y: oy + 1, z: oz, block: "minecraft:air" });
  out.push({ x: ox + 3, y: oy + 2, z: oz, block: "minecraft:air" });
  out.push({ x: ox + 3, y: oy + 1, z: oz, block: "minecraft:oak_door[half=lower,facing=south,open=false]" });
  out.push({ x: ox + 3, y: oy + 2, z: oz, block: "minecraft:oak_door[half=upper,facing=south,open=false]" });

  // Windows (glass panes) on each wall
  // South wall windows
  for (const wx of [ox + 1, ox + 5]) {
    out.push({ x: wx, y: oy + 2, z: oz, block: "minecraft:glass_pane" });
    out.push({ x: wx, y: oy + 3, z: oz, block: "minecraft:glass_pane" });
  }
  // North wall windows
  for (const wx of [ox + 1, ox + 3, ox + 5]) {
    out.push({ x: wx, y: oy + 2, z: oz + 7, block: "minecraft:glass_pane" });
    out.push({ x: wx, y: oy + 3, z: oz + 7, block: "minecraft:glass_pane" });
  }
  // East/west wall windows
  for (const wz of [oz + 2, oz + 5]) {
    out.push({ x: ox, y: oy + 2, z: wz, block: "minecraft:glass_pane" });
    out.push({ x: ox, y: oy + 3, z: wz, block: "minecraft:glass_pane" });
    out.push({ x: ox + 6, y: oy + 2, z: wz, block: "minecraft:glass_pane" });
    out.push({ x: ox + 6, y: oy + 3, z: wz, block: "minecraft:glass_pane" });
  }

  // Interior furniture
  out.push({ x: ox + 1, y: oy + 1, z: oz + 6, block: "minecraft:crafting_table" });
  out.push({ x: ox + 1, y: oy + 1, z: oz + 5, block: "minecraft:bookshelf" });
  out.push({ x: ox + 1, y: oy + 2, z: oz + 5, block: "minecraft:bookshelf" });
  out.push({ x: ox + 5, y: oy + 1, z: oz + 6, block: "minecraft:barrel[facing=up]" });
  out.push({ x: ox + 5, y: oy + 1, z: oz + 5, block: "minecraft:chest[facing=south]" });
  // Table (slab on fence)
  out.push({ x: ox + 3, y: oy + 1, z: oz + 4, block: "minecraft:oak_fence" });
  out.push({ x: ox + 3, y: oy + 2, z: oz + 4, block: "minecraft:oak_slab[type=bottom]" });
  // Carpet
  for (let cx = ox + 2; cx <= ox + 4; cx += 1)
    for (let cz = oz + 2; cz <= oz + 3; cz += 1)
      out.push({ x: cx, y: oy + 1, z: cz, block: "minecraft:red_carpet" });
  // Lantern inside
  out.push({ x: ox + 3, y: oy + 4, z: oz + 3, block: "minecraft:lantern[hanging=true]" });
  // Flower pot at entrance
  out.push({ x: ox + 2, y: oy + 1, z: oz + 1, block: "minecraft:potted_poppy" });

  return out;
};

/* ── wall_segment ────────────────────────────────────────────────── */

export const createWallSegment = (
  origin: Vector3Like,
  length = 10,
  block = "minecraft:stone_bricks",
): BlockPlacement[] => {
  const out: BlockPlacement[] = [];
  const height = 4;

  // Foundation
  pushCuboid(out,
    { x: origin.x, y: origin.y - 1, z: origin.z },
    { x: origin.x + length - 1, y: origin.y - 1, z: origin.z + 1 },
    "minecraft:cobblestone",
  );

  // Main wall (2 blocks thick)
  pushCuboid(out,
    { x: origin.x, y: origin.y, z: origin.z },
    { x: origin.x + length - 1, y: origin.y + height - 1, z: origin.z + 1 },
    block,
  );

  // Crenellations on top
  for (let x = origin.x; x < origin.x + length; x += 2) {
    out.push({ x, y: origin.y + height, z: origin.z, block });
    out.push({ x, y: origin.y + height, z: origin.z + 1, block });
  }

  // Buttresses every 4 blocks
  for (let x = origin.x; x <= origin.x + length - 1; x += 4) {
    pushCuboid(out,
      { x, y: origin.y, z: origin.z + 2 },
      { x, y: origin.y + height - 2, z: origin.z + 2 },
      block,
    );
  }

  // Arrow slits
  for (let x = origin.x + 1; x < origin.x + length - 1; x += 3) {
    out.push({ x, y: origin.y + 2, z: origin.z, block: "minecraft:air" });
  }

  return out;
};

/* ── arch ────────────────────────────────────────────────────────── */

export const createArch = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const block = palette[0] ?? "minecraft:cut_sandstone";
  const trim  = palette[1] ?? "minecraft:chiseled_sandstone";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Two pillars (2x2 each, 5 blocks tall)
  for (const px of [ox, ox + 5]) {
    pushCuboid(out, { x: px, y: oy, z: oz }, { x: px + 1, y: oy + 4, z: oz + 1 }, block);
    // decorative trim at top and base of pillars
    pushCuboid(out, { x: px, y: oy + 5, z: oz }, { x: px + 1, y: oy + 5, z: oz + 1 }, trim);
    pushCuboid(out, { x: px, y: oy, z: oz }, { x: px + 1, y: oy, z: oz + 1 }, trim);
  }

  // Archway span
  pushCuboid(out, { x: ox, y: oy + 5, z: oz }, { x: ox + 6, y: oy + 6, z: oz + 1 }, block);
  pushCuboid(out, { x: ox + 2, y: oy + 5, z: oz }, { x: ox + 4, y: oy + 5, z: oz + 1 }, trim);

  // Clear walkway under arch
  pushCuboid(out, { x: ox + 2, y: oy, z: oz }, { x: ox + 4, y: oy + 4, z: oz + 1 }, "minecraft:air");

  // Torches on pillars
  out.push({ x: ox + 2, y: oy + 4, z: oz, block: "minecraft:wall_torch[facing=east]" });
  out.push({ x: ox + 4, y: oy + 4, z: oz + 1, block: "minecraft:wall_torch[facing=west]" });

  return out;
};

/* ── rubble_pile ──────────────────────────────────────────────────── */

export const createRubblePile = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const primary   = palette[0] ?? "minecraft:cobblestone";
  const secondary = palette[1] ?? "minecraft:tuff";
  const accent    = palette[2] ?? "minecraft:gravel";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Ground layer (5x5 irregular)
  const groundBlocks = [primary, secondary, accent, primary, secondary];
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const dist = Math.abs(dx) + Math.abs(dz);
      if (dist <= 3) {
        const r = seededRandom(ox + dx, oz + dz);
        const b = groundBlocks[Math.floor(r * groundBlocks.length)];
        out.push({ x: ox + dx, y: oy, z: oz + dz, block: b });
      }
    }
  }

  // Second layer (3x3 partial)
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (seededRandom(ox + dx + 7, oz + dz + 3) > 0.35) {
        const b = seededRandom(ox + dx, oz + dz + 5) > 0.5 ? primary : secondary;
        out.push({ x: ox + dx, y: oy + 1, z: oz + dz, block: b });
      }
    }
  }

  // Top accent blocks
  out.push({ x: ox, y: oy + 2, z: oz, block: primary });
  if (seededRandom(ox + 1, oz + 1) > 0.4) {
    out.push({ x: ox + 1, y: oy + 2, z: oz, block: secondary });
  }

  // Scattered slabs for detail
  out.push({ x: ox - 2, y: oy, z: oz + 1, block: "minecraft:stone_brick_slab[type=bottom]" });
  out.push({ x: ox + 2, y: oy, z: oz - 1, block: "minecraft:cobblestone_slab[type=bottom]" });

  // Moss/vines for weathering
  out.push({ x: ox - 1, y: oy + 1, z: oz - 1, block: "minecraft:moss_carpet" });
  out.push({ x: ox + 1, y: oy, z: oz + 2, block: "minecraft:moss_carpet" });

  return out;
};

/* ── market_stall ────────────────────────────────────────────────── */

export const createMarketStall = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const frame = palette[0] ?? "minecraft:stripped_oak_log";
  const counter = palette[1] ?? "minecraft:oak_planks";
  const awning = palette[2] ?? "minecraft:red_wool";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // 4 corner posts
  for (const [px, pz] of [[0, 0], [4, 0], [0, 3], [4, 3]]) {
    pushCuboid(out, { x: ox + px, y: oy, z: oz + pz }, { x: ox + px, y: oy + 3, z: oz + pz }, frame);
  }

  // Counter (front)
  pushCuboid(out, { x: ox, y: oy + 1, z: oz }, { x: ox + 4, y: oy + 1, z: oz }, counter);

  // Awning (sloped)
  pushCuboid(out, { x: ox, y: oy + 4, z: oz - 1 }, { x: ox + 4, y: oy + 4, z: oz + 1 }, awning);
  pushCuboid(out, { x: ox, y: oy + 3, z: oz + 2 }, { x: ox + 4, y: oy + 3, z: oz + 3 }, awning);

  // Goods on counter
  out.push({ x: ox + 1, y: oy + 2, z: oz, block: "minecraft:potted_fern" });
  out.push({ x: ox + 3, y: oy + 2, z: oz, block: "minecraft:melon" });

  // Crates behind
  out.push({ x: ox + 1, y: oy, z: oz + 2, block: "minecraft:barrel[facing=up]" });
  out.push({ x: ox + 2, y: oy, z: oz + 2, block: "minecraft:barrel[facing=up]" });
  out.push({ x: ox + 1, y: oy + 1, z: oz + 2, block: "minecraft:barrel[facing=up]" });
  out.push({ x: ox + 3, y: oy, z: oz + 2, block: "minecraft:hay_block" });

  // Lantern
  out.push({ x: ox + 2, y: oy + 3, z: oz + 1, block: "minecraft:lantern[hanging=true]" });

  return out;
};

/* ── fountain ────────────────────────────────────────────────────── */

export const createFountain = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const stone = palette[0] ?? "minecraft:smooth_stone";
  const trim  = palette[1] ?? "minecraft:chiseled_stone_bricks";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Basin ring (5x5 ring, 2 high)
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const isEdge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      const isCorner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      if (isEdge && !isCorner) {
        out.push({ x: ox + dx, y: oy, z: oz + dz, block: stone });
        out.push({ x: ox + dx, y: oy + 1, z: oz + dz, block: stone });
      }
    }
  }

  // Corner pillars (slightly taller)
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    out.push({ x: ox + dx, y: oy, z: oz + dz, block: stone });
    out.push({ x: ox + dx, y: oy + 1, z: oz + dz, block: trim });
    out.push({ x: ox + dx, y: oy + 2, z: oz + dz, block: "minecraft:stone_brick_wall" });
  }

  // Water inside basin
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      out.push({ x: ox + dx, y: oy, z: oz + dz, block: "minecraft:water" });
    }
  }

  // Center pillar
  out.push({ x: ox, y: oy + 1, z: oz, block: trim });
  out.push({ x: ox, y: oy + 2, z: oz, block: trim });
  out.push({ x: ox, y: oy + 3, z: oz, block: "minecraft:sea_lantern" });

  return out;
};

/* ── column_row (colonnade) ──────────────────────────────────────── */

export const createColumnRow = (
  origin: Vector3Like,
  palette: string[],
  count = 4,
  spacing = 3,
): BlockPlacement[] => {
  const block = palette[0] ?? "minecraft:quartz_pillar";
  const cap   = palette[1] ?? "minecraft:smooth_quartz";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  for (let i = 0; i < count; i += 1) {
    const cz = oz + i * spacing;
    // Column shaft (5 tall)
    pushCuboid(out, { x: ox, y: oy, z: cz }, { x: ox, y: oy + 4, z: cz }, block);
    // Capital
    out.push({ x: ox, y: oy + 5, z: cz, block: cap });
    out.push({ x: ox - 1, y: oy + 5, z: cz, block: "minecraft:smooth_quartz_slab[type=bottom]" });
    out.push({ x: ox + 1, y: oy + 5, z: cz, block: "minecraft:smooth_quartz_slab[type=bottom]" });
    // Base
    out.push({ x: ox - 1, y: oy, z: cz, block: "minecraft:smooth_quartz_slab[type=bottom]" });
    out.push({ x: ox + 1, y: oy, z: cz, block: "minecraft:smooth_quartz_slab[type=bottom]" });
  }

  // Entablature (top beam connecting columns)
  if (count > 1) {
    pushCuboid(out,
      { x: ox, y: oy + 6, z: oz },
      { x: ox, y: oy + 6, z: oz + (count - 1) * spacing },
      cap,
    );
  }

  return out;
};

/* ── plaza ───────────────────────────────────────────────────────── */

export const createPlaza = (
  origin: Vector3Like,
  palette: string[],
  size = 9,
): BlockPlacement[] => {
  const primary   = palette[0] ?? "minecraft:smooth_stone";
  const secondary = palette[1] ?? "minecraft:polished_andesite";
  const accent    = palette[2] ?? "minecraft:stone_bricks";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const half = Math.floor(size / 2);

  for (let dx = -half; dx <= half; dx += 1) {
    for (let dz = -half; dz <= half; dz += 1) {
      // Checkerboard pattern
      const isEdge = Math.abs(dx) === half || Math.abs(dz) === half;
      const isChecker = (dx + dz) % 2 === 0;
      const block = isEdge ? accent : isChecker ? primary : secondary;
      out.push({ x: ox + dx, y: oy, z: oz + dz, block });
    }
  }

  // Corner posts with lanterns
  for (const [dx, dz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
    out.push({ x: ox + dx, y: oy + 1, z: oz + dz, block: "minecraft:stone_brick_wall" });
    out.push({ x: ox + dx, y: oy + 2, z: oz + dz, block: "minecraft:lantern" });
  }

  return out;
};

/* ── tower (small watchtower) ────────────────────────────────────── */

export const createTower = (
  origin: Vector3Like,
  palette: string[],
): BlockPlacement[] => {
  const wall = palette[0] ?? "minecraft:stone_bricks";
  const trim = palette[1] ?? "minecraft:stripped_spruce_log";
  const roof = palette[2] ?? "minecraft:dark_oak_planks";
  const out: BlockPlacement[] = [];
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;

  // Foundation
  pushCuboid(out, { x: ox, y: oy - 1, z: oz }, { x: ox + 4, y: oy - 1, z: oz + 4 }, "minecraft:cobblestone");

  // Walls (4x4 base, 7 tall)
  pushHollowCuboid(out, { x: ox, y: oy, z: oz }, { x: ox + 4, y: oy + 6, z: oz + 4 }, wall);

  // Clear interior
  pushCuboid(out, { x: ox + 1, y: oy, z: oz + 1 }, { x: ox + 3, y: oy + 5, z: oz + 3 }, "minecraft:air");

  // Corner trim
  for (const [cx, cz] of [[ox, oz], [ox + 4, oz], [ox, oz + 4], [ox + 4, oz + 4]]) {
    pushCuboid(out, { x: cx, y: oy, z: cz }, { x: cx, y: oy + 7, z: cz }, trim);
  }

  // Door
  out.push({ x: ox + 2, y: oy, z: oz, block: "minecraft:air" });
  out.push({ x: ox + 2, y: oy + 1, z: oz, block: "minecraft:air" });

  // Internal stairs (ladder)
  for (let y = oy; y <= oy + 5; y += 1) {
    out.push({ x: ox + 1, y, z: oz + 1, block: "minecraft:ladder[facing=south]" });
  }

  // Observation platform
  pushCuboid(out, { x: ox - 1, y: oy + 7, z: oz - 1 }, { x: ox + 5, y: oy + 7, z: oz + 5 }, roof);

  // Battlements on platform
  for (let x = ox - 1; x <= ox + 5; x += 2) {
    out.push({ x, y: oy + 8, z: oz - 1, block: wall });
    out.push({ x, y: oy + 8, z: oz + 5, block: wall });
  }
  for (let z = oz - 1; z <= oz + 5; z += 2) {
    out.push({ x: ox - 1, y: oy + 8, z, block: wall });
    out.push({ x: ox + 5, y: oy + 8, z, block: wall });
  }

  // Torch on top
  out.push({ x: ox + 2, y: oy + 8, z: oz + 2, block: "minecraft:torch" });

  return out;
};

export { pushCuboid, pushHollowCuboid, seededRandom };
