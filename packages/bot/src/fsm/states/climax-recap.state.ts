import { say, sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createClimaxRecapState = (): TutorState => ({
  name: "CLIMAX_RECAP",
  async onEnter(ctx) {
    ctx.memory.recapAsked = true;
    ctx.memory.recapAnswer = null;
    await ctx.persistState(
      {
        status: "climax_recap",
        runtime: {
          ...ctx.session.runtime,
          currentState: "CLIMAX_RECAP",
        },
      },
      "CLIMAX_RECAP",
    );
    await sayLines(ctx, [
      "Before we finish, give me one big idea from this chapter.",
      "Type it in chat. It can be a cause, effect, or detail you want to remember.",
    ]);
  },
  async onTick(ctx) {
    const elapsed = Date.now() - ctx.memory.stateEnteredAt;
    if (ctx.memory.recapAnswer || elapsed > 25_000) {
      const learningObjective = ctx.session.experiencePackage.learningObjectives[0] ?? "the main historical idea";
      await say(ctx, `Strong finish. The key takeaway here is ${learningObjective.toLowerCase()}.`);
      return transition("END_SESSION");
    }
    return null;
  },
  async onChat(ctx, username, message) {
    if (username === ctx.memory.selectedPlayer) {
      return transition("END_SESSION", {
        recapAnswer: { username, message },
      });
    }
    return null;
  },
  async onExit() {},
});
