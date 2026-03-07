import { sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createIntroduceState = (): TutorState => ({
  name: "INTRODUCE",
  async onEnter(ctx) {
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
      "Follow me and answer the questions in chat.",
      "Say 'ready' when you want to begin.",
    ]);
    ctx.memory.introStartedAt = Date.now();
  },
  async onTick(ctx) {
    if (ctx.memory.introStartedAt && Date.now() - ctx.memory.introStartedAt >= 15_000) {
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
