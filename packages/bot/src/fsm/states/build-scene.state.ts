import type { SessionState } from "../../contracts.js";
import { transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createBuildSceneState = (): TutorState => ({
  name: "BUILD_SCENE",
  async onEnter(ctx) {
    ctx.memory.buildInFlight = false;
    ctx.memory.buildComplete = Boolean(ctx.session.buildPlan);
    await ctx.persistState(
      {
        status: "building_scene",
        runtime: {
          ...ctx.session.runtime,
          currentState: "BUILD_SCENE",
          buildProgress: ctx.memory.buildComplete ? 1 : 0,
        },
      },
      "BUILD_SCENE",
    );
  },
  async onTick(ctx) {
    if (ctx.memory.buildComplete) {
      return transition("WAIT_FOR_PLAYER");
    }

    if (ctx.memory.buildInFlight) {
      return null;
    }

    ctx.memory.buildInFlight = true;

    try {
      const result = await ctx.sceneBuilder.buildScene(ctx.bot, ctx.session, ctx.config.geminiApiKey, async (value) => {
        await ctx.persistState(
          {
            buildProgress: {
              completedCommands: Math.round(value * 100),
              totalCommands: 100,
              percent: Number((value * 100).toFixed(0)),
              currentStep: "Constructing the historical scene",
            } as unknown as SessionState["buildProgress"],
            runtime: {
              ...ctx.session.runtime,
              currentState: "BUILD_SCENE",
              buildProgress: Number(value.toFixed(2)),
            },
          },
          "BUILD_SCENE",
        );
        await ctx.emitEvent("build_progress", {
          completedCommands: Math.round(value * 100),
          totalCommands: 100,
          percent: Number((value * 100).toFixed(0)),
          currentStep: "Constructing the historical scene",
        });
      });

      ctx.session = {
        ...ctx.session,
        buildPlan: result.buildPlan,
        buildSummary: result.buildSummary,
      };
      ctx.memory.buildComplete = true;
      await ctx.persistState(
        {
          status: "waiting_for_player",
          buildPlan: result.buildPlan,
          buildSummary: result.buildSummary,
          buildProgress: {
            completedCommands: result.buildSummary.commandCount,
            totalCommands: result.buildSummary.commandCount,
            percent: 100,
            currentStep: "Scene build complete",
          } as unknown as SessionState["buildProgress"],
          runtime: {
            ...ctx.session.runtime,
            currentState: "BUILD_SCENE",
            buildProgress: 1,
          },
        },
        "BUILD_SCENE",
      );
      return transition("WAIT_FOR_PLAYER");
    } catch (error) {
      await ctx.emitEvent("error", {
        state: "BUILD_SCENE",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      ctx.memory.buildInFlight = false;
    }
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
