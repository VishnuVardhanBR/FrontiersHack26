import { getCurrentRegion, getRegionCenter, say, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createEscortToRegionState = (): TutorState => ({
  name: "ESCORT_TO_REGION",
  async onEnter(ctx) {
    const region = getCurrentRegion(ctx);
    await ctx.persistState(
      {
        status: "escorting",
        runtime: {
          ...ctx.session.runtime,
          currentState: "ESCORT_TO_REGION",
          activeRegionId: region?.id,
          selectedPlayer: ctx.memory.selectedPlayer,
        },
      },
      "ESCORT_TO_REGION",
    );

    if (region) {
      await say(ctx, `Follow me to the ${region.purpose.replace(/_/g, " ")}.`);
    }
  },
  async onTick(ctx) {
    const region = getCurrentRegion(ctx);
    if (!region) {
      return transition("CLIMAX_RECAP");
    }

    const target = getRegionCenter(ctx, region.id);
    if (!target) {
      return transition("NARRATE");
    }

    const player = ctx.memory.selectedPlayer ? ctx.playerTracker.getPlayer(ctx.memory.selectedPlayer) : null;
    await ctx.escort.escortPlayer(target, player?.position ?? null);
    await say(ctx, "Here we are. Take a look around.");
    await delay(1500);
    return transition("NARRATE");
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
