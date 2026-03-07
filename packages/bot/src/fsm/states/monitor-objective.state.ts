import { asVec3 } from "../../contracts.js";
import { say, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createMonitorObjectiveState = (): TutorState => ({
  name: "MONITOR_OBJECTIVE",
  async onEnter(ctx) {
    ctx.memory.objectiveStartedAt = Date.now();
    ctx.memory.objectiveHintCount = 0;
    const objective = ctx.session.experiencePackage.studentObjective;
    await ctx.persistState(
      {
        status: "monitoring_objective",
        runtime: {
          ...ctx.session.runtime,
          currentState: "MONITOR_OBJECTIVE",
        },
      },
      "MONITOR_OBJECTIVE",
    );
    await say(
      ctx,
      `Final objective: find the ${objective.narrativeLabel ?? objective.itemName ?? "artifact"} near the last region.`,
    );
  },
  async onTick(ctx) {
    const placement = ctx.session.buildPlan?.objectivePlacement;
    const username = ctx.memory.selectedPlayer;
    const player = username ? ctx.playerTracker.getPlayer(username) : null;

    if (placement && player && ctx.triggerMonitor.isWithinRadius(player.position, asVec3(placement.position), 4)) {
      await say(ctx, "You found it. That wraps the exploration objective.");
      await ctx.emitEvent("status", {
        status: "monitoring_objective",
        message: `${username} found the ${placement.narrativeLabel ?? placement.itemName}.`,
      });
      await ctx.persistState(
        {
          runtime: {
            ...ctx.session.runtime,
            itemFound: true,
          },
        },
        "MONITOR_OBJECTIVE",
      );
      return transition("CLIMAX_RECAP");
    }

    const elapsed = Date.now() - (ctx.memory.objectiveStartedAt ?? Date.now());
    if (elapsed > (ctx.memory.objectiveHintCount + 1) * 20_000) {
      ctx.memory.objectiveHintCount += 1;
      const region = ctx.session.experiencePackage.sceneSpec.regions.at(-1);
      await say(
        ctx,
        `Hint: search around ${region?.description?.toLowerCase() ?? "the final area"} and look near decorated blocks.`,
      );
    }

    if (elapsed > 75_000) {
      await say(ctx, "We'll wrap up here so we can recap the history.");
      return transition("CLIMAX_RECAP");
    }

    return null;
  },
  async onChat(ctx, username, message) {
    if (username === ctx.memory.selectedPlayer && /found|artifact|chest/i.test(message)) {
      return transition("CLIMAX_RECAP");
    }
    return null;
  },
  async onExit() {},
});
