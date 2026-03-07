import { say, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createWaitForPlayerState = (): TutorState => ({
  name: "WAIT_FOR_PLAYER",
  async onEnter(ctx) {
    await ctx.persistState(
      {
        status: "waiting_for_player",
        runtime: {
          ...ctx.session.runtime,
          currentState: "WAIT_FOR_PLAYER",
          selectedPlayer: undefined,
        },
      },
      "WAIT_FOR_PLAYER",
    );

    const spawn = ctx.session.buildPlan?.spawnPoint ?? { x: 0, y: 4, z: 0 };
    ctx.bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
    await say(ctx, "Scene ready. Join when you like — I'll bring you to the start.");
  },
  async onTick(ctx) {
    const player = ctx.playerTracker.getNearestPlayer();
    if (!player) {
      return null;
    }

    // Teleport the player to the build's spawn point so they land right in the world.
    const spawn = ctx.session.buildPlan?.spawnPoint ?? { x: 0, y: 4, z: 0 };
    ctx.bot.chat(`/tp ${player.username} ${spawn.x} ${spawn.y} ${spawn.z}`);

    return transition("INTRODUCE", {
      selectedPlayer: player.username,
    });
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
