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
    await say(ctx, "Scene ready. Walk near me to begin the history tour.");
  },
  async onTick(ctx) {
    const player = ctx.playerTracker.getNearestPlayer();
    if (player && player.distance <= 10) {
      return transition("INTRODUCE", {
        selectedPlayer: player.username,
      });
    }

    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
