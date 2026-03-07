import { getCurrentRegion, getRegionCenter, say, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

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

    await say(ctx, `Follow me to the ${region.purpose.replace(/_/g, " ")}.`);
    const player = ctx.memory.selectedPlayer ? ctx.playerTracker.getPlayer(ctx.memory.selectedPlayer) : null;
    await ctx.escort.escortPlayer(target, player?.position ?? null);
    return transition("NARRATE");
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
