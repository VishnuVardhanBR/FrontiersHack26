import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";

export interface TrackedPlayer {
  username: string;
  position: Vec3;
  distance: number;
}

export class PlayerTracker {
  constructor(private readonly bot: Bot) {}

  getNearestPlayer(): TrackedPlayer | null {
    const botPosition = this.bot.entity.position;
    const tracked = Object.entries(this.bot.players)
      .filter(([username, player]) => username !== this.bot.username && player.entity)
      .map(([username, player]) => {
        const position = player.entity!.position.clone();
        return {
          username,
          position,
          distance: position.distanceTo(botPosition),
        };
      })
      .sort((left, right) => left.distance - right.distance);

    return tracked[0] ?? null;
  }

  getPlayer(username: string): TrackedPlayer | null {
    const player = this.bot.players[username];
    if (!player?.entity) {
      return null;
    }

    return {
      username,
      position: player.entity.position.clone(),
      distance: player.entity.position.distanceTo(this.bot.entity.position),
    };
  }
}
