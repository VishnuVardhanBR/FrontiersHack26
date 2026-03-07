import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import {
  CHAMBER_GLOW,
  PEDESTAL_TOP,
  SEAL_DOOR_MAX,
  SEAL_DOOR_MIN,
} from "./alexandria-scene.js";

/**
 * Returns true if the pedestal top block is considered "scroll restored"
 * (any non-air block — player places e.g. paper item or a block like oak_planks).
 */
export function checkScrollRestored(bot: Bot): boolean {
  const block = bot.blockAt(new Vec3(PEDESTAL_TOP.x, PEDESTAL_TOP.y, PEDESTAL_TOP.z));
  if (!block) return false;
  const name = block.name ?? "";
  return name !== "air" && name !== "cave_air" && name !== "void_air";
}

/**
 * Opens the seal door (set to air) and places lights in the knowledge chamber.
 * Call after checkScrollRestored is true.
 */
export async function triggerArchiveOpen(bot: Bot): Promise<void> {
  const air = "minecraft:air";
  const light = "minecraft:lantern[hanging=false]";

  for (let x = SEAL_DOOR_MIN.x; x <= SEAL_DOOR_MAX.x; x += 1) {
    for (let y = SEAL_DOOR_MIN.y; y <= SEAL_DOOR_MAX.y; y += 1) {
      for (let z = SEAL_DOOR_MIN.z; z <= SEAL_DOOR_MAX.z; z += 1) {
        await bot.chat(`/setblock ${x} ${y} ${z} ${air}`);
      }
    }
  }

  for (const pos of CHAMBER_GLOW) {
    await bot.chat(`/setblock ${pos.x} ${pos.y} ${pos.z} ${light}`);
  }
}
