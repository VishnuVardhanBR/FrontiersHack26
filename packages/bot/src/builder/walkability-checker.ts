import type { Bot } from "mineflayer";
import mineflayerPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";

import { Vector3Like } from "../contracts.js";

const { goals, Movements } = mineflayerPathfinder;

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export class WalkabilityChecker {
  constructor(private readonly bot: Bot) {}

  async verify(regionCenters: Vector3Like[]): Promise<boolean> {
    if (regionCenters.length < 2) {
      return true;
    }

    const pathfinder = (this.bot as Bot & { pathfinder?: { setMovements: (movements: unknown) => void; goto: (goal: unknown) => Promise<void> } }).pathfinder;
    if (!pathfinder) {
      return true;
    }

    const movements = new Movements(this.bot);
    movements.canDig = false;
    pathfinder.setMovements(movements);

    for (const center of regionCenters) {
      try {
        await withTimeout(pathfinder.goto(new goals.GoalNear(center.x, center.y, center.z, 3)), 12_000);
      } catch {
        return false;
      }
    }

    return true;
  }
}
