import { getCurrentQuestion, getCurrentRegion, isLastRegion, sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createNarrateState = (): TutorState => ({
  name: "NARRATE",
  async onEnter(ctx) {
    const region = getCurrentRegion(ctx);
    if (!region) {
      return;
    }

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
  },
  async onTick(ctx) {
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
  async onChat() {
    return null;
  },
  async onExit() {},
});
