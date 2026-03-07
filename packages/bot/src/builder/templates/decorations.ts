import { BlockPlacement, Vector3Like } from "../../contracts.js";

/** Build sign NBT for 1.20+: messages are JSON strings; use plain string for readable text. */
function signNbt(line1: string, line2 = "", line3 = "", line4 = ""): string {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const a = [escape(line1), escape(line2), escape(line3), escape(line4)].map((s) => `"${s}"`);
  return `{front_text:{messages:[${a.join(",")}]}}`;
}

export const createSignPost = (origin: Vector3Like, text: string): BlockPlacement[] => {
  const lines = text.split("\n").slice(0, 4);
  const nbt = signNbt(lines[0] ?? "", lines[1] ?? "", lines[2] ?? "", lines[3] ?? "");
  return [
    { x: origin.x, y: origin.y, z: origin.z, block: "minecraft:oak_fence" },
    { x: origin.x, y: origin.y + 1, z: origin.z, block: "minecraft:oak_sign[rotation=8]", nbt },
  ];
};

export const createTorchLine = (origin: Vector3Like, length = 5): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let z = 0; z < length; z += 2) {
    placements.push({ x: origin.x, y: origin.y, z: origin.z + z, block: "minecraft:torch" });
  }
  return placements;
};

export const createItemChest = (
  origin: Vector3Like,
  itemName: string,
  label?: string,
): BlockPlacement[] => {
  const name = label ?? "Chest";
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      block: "minecraft:chest[facing=south]",
      nbt: `{CustomName:'{"text":"${escaped}"}',Items:[{Slot:0b,id:"minecraft:${itemName}",Count:1b}]}`,
    },
  ];
};
