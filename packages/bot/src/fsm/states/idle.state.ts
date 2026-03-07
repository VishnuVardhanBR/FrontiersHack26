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
  async onTick(ctx) {
    // Only proceed when the teacher has explicitly queued this session via the
    // "Start Build" button. Any other status means the session arrived stale
    // from a previous run and must not auto-build.
    if (ctx.session.status !== "queued") {
      return null;
    }
    return transition("BUILD_SCENE");
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
