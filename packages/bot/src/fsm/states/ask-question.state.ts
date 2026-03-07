import { getCurrentQuestion, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createAskQuestionState = (): TutorState => ({
  name: "ASK_QUESTION",
  async onEnter(ctx) {
    const question = getCurrentQuestion(ctx);
    if (!question) {
      return;
    }

    ctx.memory.pendingAnswer = null;
    ctx.memory.questionHintGiven = false;
    ctx.memory.currentQuestionId = question.id;
    ctx.tracker.beginQuestion(question.id);
    await ctx.persistState(
      {
        status: "asking_question",
        runtime: {
          ...ctx.session.runtime,
          currentState: "ASK_QUESTION",
          currentQuestionId: question.id,
        },
      },
      "ASK_QUESTION",
    );
    await ctx.questionAsker.ask(ctx.bot, question);
    await ctx.appendChatMessage("bot", ctx.config.botUsername, `Question: ${question.prompt}. Type your answer in chat when you're ready.`);
  },
  async onTick(ctx) {
    const question = getCurrentQuestion(ctx);
    if (!question) {
      return transition("ESCORT_TO_REGION", {
        regionIndex: ctx.memory.regionIndex + 1,
      });
    }

    if (ctx.memory.pendingAnswer) {
      return transition("EVALUATE_ANSWER");
    }

    const elapsed = Date.now() - ctx.memory.stateEnteredAt;
    if (!ctx.memory.questionHintGiven && elapsed > 20_000) {
      const attempts = (ctx.memory.questionAttempts[question.id] ?? 0) + 1;
      const hint = ctx.hintManager.getHint(question, attempts, ctx.session.experiencePackage.fallbackHints);
      ctx.memory.questionHintGiven = true;
      ctx.tracker.recordHint(question.id);
      await ctx.narrator.say(ctx.bot, `Hint: ${hint}`);
    }

    if (elapsed > 45_000) {
      ctx.memory.pendingAnswer = {
        username: ctx.memory.selectedPlayer ?? "student",
        message: "",
      };
      return transition("EVALUATE_ANSWER");
    }

    return null;
  },
  async onChat(ctx, username, message) {
    if (username === ctx.memory.selectedPlayer) {
      return transition("EVALUATE_ANSWER", {
        pendingAnswer: { username, message },
      });
    }
    return null;
  },
  async onExit() {},
});
