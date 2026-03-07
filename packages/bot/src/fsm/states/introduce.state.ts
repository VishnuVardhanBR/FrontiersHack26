import { sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createIntroduceState = (): TutorState => ({
  name: "INTRODUCE",
  async onEnter(ctx) {
    ctx.memory.introStartedAt = Date.now();
    const experience = ctx.session.experiencePackage;
    await ctx.persistState(
      {
        status: "introducing",
        runtime: {
          ...ctx.session.runtime,
          currentState: "INTRODUCE",
          selectedPlayer: ctx.memory.selectedPlayer,
        },
      },
      "INTRODUCE",
    );
    await sayLines(ctx, [
      `Welcome to ${experience.title}.`,
      experience.historicalSummary,
      `We are exploring ${experience.sceneSpec.theme}.`,
      "Follow me, answer the chat questions, and type ready if you want to move sooner.",
    ]);
  },
  async onTick(ctx) {
    if ((ctx.memory.introStartedAt ?? 0) + 10_000 <= Date.now()) {
      return transition("ESCORT_TO_REGION");
    }
    return null;
  },
  async onChat(ctx, username, message) {
    if (username === ctx.memory.selectedPlayer && message.toLowerCase().includes("ready")) {
      return transition("ESCORT_TO_REGION");
    }
    return null;
  },
  async onExit() {},
});
