import { LIBRARY_ALEXANDRIA_EXPERIENCE_ID } from "../../plans/alexandria-build.js";
import { say, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createWaitForPlayerState = (): TutorState => ({
  name: "WAIT_FOR_PLAYER",
  async onEnter(ctx) {
    await ctx.persistState(
      {
        status: "waiting_for_player",
        runtime: {
          ...ctx.session.runtime,
          currentState: "WAIT_FOR_PLAYER",
          selectedPlayer: undefined,
        },
      },
      "WAIT_FOR_PLAYER",
    );
    const isAlexandria = ctx.session.experiencePackage?.experienceId === LIBRARY_ALEXANDRIA_EXPERIENCE_ID;
    await say(
      ctx,
      isAlexandria
        ? "The Lost Library is ready. Walk near me to begin."
        : "Scene ready. Walk near me to begin the history tour.",
    );
  },
  async onTick(ctx) {
    const player = ctx.playerTracker.getNearestPlayer();
    if (!player || player.distance > 10) {
      return null;
    }
    const isAlexandria = ctx.session.experiencePackage?.experienceId === LIBRARY_ALEXANDRIA_EXPERIENCE_ID;
    return transition(isAlexandria ? "ALEX_INTRO" : "INTRODUCE", {
      selectedPlayer: player.username,
    });
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
