import type { Bot } from "mineflayer";
import mineflayerPathfinder from "mineflayer-pathfinder";
import { Vec3 } from "vec3";

export interface EscortOptions {
  routeRadius: number;
}

const { goals, Movements } = mineflayerPathfinder;

export class EscortController {
  private readonly movements: InstanceType<typeof Movements>;

  constructor(
    private readonly bot: Bot,
    private readonly options: EscortOptions,
  ) {
    this.movements = new Movements(bot);
    this.movements.allow1by1towers = false;
    this.movements.canDig = false;
  }

  async escortTo(target: Vec3): Promise<void> {
    const pathfinder = (this.bot as Bot & { pathfinder?: { setMovements: (movements: unknown) => void; goto: (goal: unknown) => Promise<void> } }).pathfinder;
    if (!pathfinder) {
      this.bot.chat(`/tp @s ${target.x} ${target.y} ${target.z}`);
      return;
    }

    pathfinder.setMovements(this.movements);
    await pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, this.options.routeRadius));
  }

  async escortPlayer(target: Vec3, playerPosition: Vec3 | null): Promise<void> {
    if (playerPosition && playerPosition.distanceTo(target) <= this.options.routeRadius + 1) {
      return;
    }

    await this.escortTo(target);
  }
}
