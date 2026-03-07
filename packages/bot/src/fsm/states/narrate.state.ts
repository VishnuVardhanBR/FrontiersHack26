import { getCurrentQuestion, getCurrentRegion, isLastRegion, sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

const QUICK_SKIP_WORDS = ["ok", "got it", "yes", "continue", "ready"];

export const createNarrateState = (): TutorState => ({
  name: "NARRATE",
  async onEnter(ctx) {
    const region = getCurrentRegion(ctx);
    if (!region) {
      return;
    }

    ctx.memory.narrateCompletedAt = undefined;

    await ctx.persistState(
      {
        status: "narrating",
        runtime: {
          ...ctx.session.runtime,
          currentState: "NARRATE",
          activeRegionId: region.id,
        },
      },
      "NARRATE",
    );

    const dialogue = ctx.session.experiencePackage.dialoguePlan.find((beat) => beat.regionId === region.id);
    await sayLines(
      ctx,
      dialogue?.lines?.length ? dialogue.lines : [region.narration ?? region.description],
    );

    ctx.memory.narrateCompletedAt = Date.now();
  },
  async onTick(ctx) {
    if (!ctx.memory.narrateCompletedAt || Date.now() - ctx.memory.narrateCompletedAt < 3_000) {
      return null;
    }

    const question = getCurrentQuestion(ctx);
    if (question) {
      return transition("ASK_QUESTION");
    }

    if (isLastRegion(ctx) && ctx.session.experiencePackage.studentObjective.type === "find_item") {
      return transition("MONITOR_OBJECTIVE");
    }

    return transition("ESCORT_TO_REGION", {
      regionIndex: ctx.memory.regionIndex + 1,
    });
  },
  async onChat(ctx, username, message) {
    if (username !== ctx.memory.selectedPlayer) {
      return null;
    }

    const lower = message.toLowerCase().trim();
    if (QUICK_SKIP_WORDS.some((word) => lower === word || lower.startsWith(word + " "))) {
      const question = getCurrentQuestion(ctx);
      if (question) {
        return transition("ASK_QUESTION");
      }

      if (isLastRegion(ctx) && ctx.session.experiencePackage.studentObjective.type === "find_item") {
        return transition("MONITOR_OBJECTIVE");
      }

      return transition("ESCORT_TO_REGION", {
        regionIndex: ctx.memory.regionIndex + 1,
      });
    }

    return null;
  },
  async onExit() {},
});
