import { BlockPlacement, Vector3Like } from "../../contracts.js";

const signNbt = (text: string): string =>
  `{front_text:{messages:['{"text":"${text.replace(/"/g, "'")}"}','{"text":""}','{"text":""}','{"text":""}']}}`;

export const createSignPost = (origin: Vector3Like, text: string): BlockPlacement[] => [
  { x: origin.x, y: origin.y, z: origin.z, block: "minecraft:oak_fence" },
  { x: origin.x, y: origin.y + 1, z: origin.z, block: "minecraft:oak_sign[rotation=8]", nbt: signNbt(text) },
];

export const createTorchLine = (origin: Vector3Like, length = 5): BlockPlacement[] => {
  const placements: BlockPlacement[] = [];
  for (let z = 0; z < length; z += 2) {
    placements.push({ x: origin.x, y: origin.y, z: origin.z + z, block: "minecraft:torch" });
  }
  return placements;
};

export const createItemChest = (origin: Vector3Like, itemName: string): BlockPlacement[] => [
  {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    block: "minecraft:chest[facing=south]",
    nbt: `{CustomName:'{"text":"Artifact Chest"}',Items:[{Slot:13b,id:"minecraft:${itemName}",Count:1b}]}`,
  },
];
