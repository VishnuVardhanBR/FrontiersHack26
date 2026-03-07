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

      // Point the world spawn at the build's spawn so players land there on join/respawn.
      const sp = result.buildPlan.spawnPoint;
      ctx.bot.chat(`/setworldspawn ${sp.x} ${sp.y} ${sp.z}`);
      ctx.bot.chat(`/spawnpoint @a ${sp.x} ${sp.y} ${sp.z}`);

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
      const message = error instanceof Error ? error.message : String(error);
      await ctx.emitEvent("error", {
        state: "BUILD_SCENE",
        message,
      });
      await ctx.emitEvent("status", {
        status: "error",
        message,
      });
      await ctx.persistState(
        {
          status: "error",
          runtime: {
            ...ctx.session.runtime,
            currentState: "BUILD_SCENE",
          },
        },
        "BUILD_SCENE",
      );
      ctx.memory.completed = true;
      return null;
    } finally {
      ctx.memory.buildInFlight = false;
    }
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
