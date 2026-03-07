import { say, sayLines, transition } from "../../helpers.js";
import { TutorState } from "../../tutor-fsm.js";
import { checkScrollRestored } from "../../../plans/alexandria-puzzle.js";
import { LIBRARY_ALEXANDRIA_EXPERIENCE_ID } from "../../../plans/alexandria-build.js";

const ALEX_DIALOGUE: Record<string, string[]> = {
  intro: [
    "Welcome to the Lost Library. Here, knowledge was precious because every text had to be preserved by people, one copy at a time.",
  ],
  shelves: [
    "Libraries were more than buildings full of books. They were places where ideas were stored, organized, and copied so they would not disappear.",
    "If even one important text was lost, future readers might never recover it.",
  ],
  pedestal: [
    "This archive is sealed until the pedestal is restored. Place any block on the pedestal — stone or planks — and the lamps will light and the chamber will open.",
    "Take the scroll from the chest as a keepsake, then place any block on the pedestal.",
  ],
  success: [
    "Well done. Preserving knowledge let later generations build on earlier discoveries instead of starting over.",
  ],
  outro: [
    "That is why libraries mattered so much. They protected memory, learning, and the spread of ideas. Thanks for exploring.",
  ],
};

const HINT_INTERVAL_MS = 15_000;

const MIN_STAY_MS = 4000;

export const createAlexandriaIntroState = (): TutorState => ({
  name: "ALEX_INTRO",
  async onEnter(ctx) {
    await sayLines(ctx, ALEX_DIALOGUE.intro);
  },
  async onTick(ctx) {
    if ((ctx.memory.stateEnteredAt ?? 0) + MIN_STAY_MS <= Date.now()) {
      return transition("ALEX_SHELVES");
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});

export const createAlexandriaShelvesState = (): TutorState => ({
  name: "ALEX_SHELVES",
  async onEnter(ctx) {
    await sayLines(ctx, ALEX_DIALOGUE.shelves);
  },
  async onTick(ctx) {
    if ((ctx.memory.stateEnteredAt ?? 0) + MIN_STAY_MS <= Date.now()) {
      return transition("ALEX_PEDESTAL_INTRO");
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});

export const createAlexandriaPedestalIntroState = (): TutorState => ({
  name: "ALEX_PEDESTAL_INTRO",
  async onEnter(ctx) {
    await sayLines(ctx, ALEX_DIALOGUE.pedestal);
  },
  async onTick(ctx) {
    if ((ctx.memory.stateEnteredAt ?? 0) + MIN_STAY_MS <= Date.now()) {
      return transition("ALEX_WAIT_SCROLL");
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});

export const createAlexandriaWaitScrollState = (): TutorState => ({
  name: "ALEX_WAIT_SCROLL",
  async onEnter() {},
  async onTick(ctx) {
    if (ctx.session.experiencePackage?.experienceId !== LIBRARY_ALEXANDRIA_EXPERIENCE_ID) {
      return transition("END_SESSION");
    }
    if (checkScrollRestored(ctx.bot)) {
      const { triggerArchiveOpen } = await import("../../../plans/alexandria-puzzle.js");
      await triggerArchiveOpen(ctx.bot);
      return transition("ALEX_SUCCESS");
    }
    const elapsed = Date.now() - (ctx.memory.stateEnteredAt ?? 0);
    if (elapsed >= HINT_INTERVAL_MS && (ctx.memory.objectiveHintCount ?? 0) < 2) {
      ctx.memory.objectiveHintCount = (ctx.memory.objectiveHintCount ?? 0) + 1;
      await say(
        ctx,
        ctx.memory.objectiveHintCount === 1
          ? "The chest has a scroll to take. Then place any block (stone, planks) on the pedestal — the lamps will light when it works."
          : "Place any block on the central pedestal. Paper cannot be placed; use a block from your hotbar.",
      );
      ctx.memory.stateEnteredAt = Date.now();
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});

export const createAlexandriaSuccessState = (): TutorState => ({
  name: "ALEX_SUCCESS",
  async onEnter(ctx) {
    await sayLines(ctx, ALEX_DIALOGUE.success);
  },
  async onTick(ctx) {
    if ((ctx.memory.stateEnteredAt ?? 0) + MIN_STAY_MS <= Date.now()) {
      return transition("ALEX_OUTRO");
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});

export const createAlexandriaOutroState = (): TutorState => ({
  name: "ALEX_OUTRO",
  async onEnter(ctx) {
    await sayLines(ctx, ALEX_DIALOGUE.outro);
  },
  async onTick(ctx) {
    if ((ctx.memory.stateEnteredAt ?? 0) + MIN_STAY_MS <= Date.now()) {
      return transition("END_SESSION");
    }
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
