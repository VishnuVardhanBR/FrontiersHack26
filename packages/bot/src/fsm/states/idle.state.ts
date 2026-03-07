import { transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createIdleState = (): TutorState => ({
  name: "IDLE",
  async onEnter(ctx) {
    await ctx.persistState(
      {
        status: "queued",
        runtime: {
          ...ctx.session.runtime,
          currentState: "IDLE",
        },
      },
      "IDLE",
    );
  },
  async onTick() {
    return transition("BUILD_SCENE");
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
