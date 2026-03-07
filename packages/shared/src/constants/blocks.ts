export const BLOCK_PALETTES = {
  roman: [
    "minecraft:smooth_sandstone",
    "minecraft:cut_sandstone",
    "minecraft:polished_andesite",
    "minecraft:stripped_oak_log",
    "minecraft:oak_planks",
  ],
  volcanic: [
    "minecraft:basalt",
    "minecraft:blackstone",
    "minecraft:magma_block",
    "minecraft:netherrack",
    "minecraft:gray_concrete_powder",
  ],
  street: [
    "minecraft:stone_bricks",
    "minecraft:cobblestone",
    "minecraft:andesite",
    "minecraft:gravel",
  ],
  greenery: [
    "minecraft:grass_block",
    "minecraft:moss_block",
    "minecraft:oak_leaves",
  ],
} as const;

export const TEMPLATE_BLOCK_HINTS = {
  flat_path: "minecraft:stone_bricks",
  simple_house: "minecraft:smooth_sandstone",
  wall_segment: "minecraft:polished_andesite",
  sign_post: "minecraft:oak_sign",
  torch_line: "minecraft:torch",
  item_chest: "minecraft:chest",
  arch: "minecraft:cut_sandstone",
  rubble_pile: "minecraft:cobblestone",
} as const;
