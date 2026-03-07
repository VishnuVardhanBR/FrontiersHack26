import { getCurrentQuestion, isLastRegion, sayLines, transition } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createEvaluateAnswerState = (): TutorState => ({
  name: "EVALUATE_ANSWER",
  async onEnter(ctx) {
    await ctx.persistState(
      {
        status: "evaluating_answer",
        runtime: {
          ...ctx.session.runtime,
          currentState: "EVALUATE_ANSWER",
        },
      },
      "EVALUATE_ANSWER",
    );
  },
  async onTick(ctx) {
    const question = getCurrentQuestion(ctx);
    const answer = ctx.memory.pendingAnswer?.message ?? "";
    if (!question) {
      return transition("ESCORT_TO_REGION", {
        regionIndex: ctx.memory.regionIndex + 1,
        pendingAnswer: null,
      });
    }

    const attempts = (ctx.memory.questionAttempts[question.id] ?? 0) + 1;
    ctx.memory.questionAttempts[question.id] = attempts;
    const evaluation = ctx.evaluator.evaluate(question, answer, attempts);
    ctx.memory.lastEvaluation = evaluation;

    ctx.tracker.recordAnswer(question.id, answer, evaluation);
    await ctx.emitEvent("question_result", {
      questionId: question.id,
      correct: evaluation.matched,
      feedback: evaluation.feedback,
      scoreDelta: evaluation.score,
    });

    if (!evaluation.shouldAdvance) {
      const hint = ctx.hintManager.getHint(question, attempts, ctx.session.experiencePackage.fallbackHints);
      ctx.tracker.recordHint(question.id);
      await sayLines(ctx, [evaluation.feedback, `Hint: ${hint}`]);
      return transition("ASK_QUESTION", {
        pendingAnswer: null,
      });
    }

    await sayLines(ctx, [
      evaluation.feedback,
      evaluation.matched ? evaluation.correctAnswerSummary : `Let's lock in the idea: ${evaluation.correctAnswerSummary}`,
    ]);

    const nextPatch = {
      pendingAnswer: null,
      currentQuestionId: undefined,
    } as const;

    if (isLastRegion(ctx)) {
      if (ctx.session.experiencePackage.studentObjective.type === "find_item") {
        return transition("MONITOR_OBJECTIVE", {
          ...nextPatch,
          regionIndex: ctx.memory.regionIndex + 1,
        });
      }

      return transition("CLIMAX_RECAP", {
        ...nextPatch,
        regionIndex: ctx.memory.regionIndex + 1,
      });
    }

    await ctx.persistState(
      {
        runtime: {
          ...ctx.session.runtime,
          currentQuestionId: undefined,
        },
      },
      "EVALUATE_ANSWER",
    );

    return transition("ESCORT_TO_REGION", {
      ...nextPatch,
      regionIndex: ctx.memory.regionIndex + 1,
    });
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
