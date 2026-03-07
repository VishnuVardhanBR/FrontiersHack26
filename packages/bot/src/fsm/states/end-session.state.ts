import { sayLines } from "../helpers.js";
import { TutorState } from "../tutor-fsm.js";

export const createEndSessionState = (): TutorState => ({
  name: "END_SESSION",
  async onEnter(ctx) {
    const summary = ctx.summaryGenerator.generate(ctx.session.experiencePackage, ctx.tracker);
    ctx.session = {
      ...ctx.session,
      summary,
      status: "completed",
    };
    await ctx.persistState(
      {
        status: "completed",
        summary,
        runtime: {
          ...ctx.session.runtime,
          currentState: "END_SESSION",
          currentQuestionId: undefined,
        },
      },
      "END_SESSION",
    );
    await ctx.emitEvent("session_complete", {
      score: summary.scorePercent,
      correctAnswers: summary.answeredCorrectly,
      totalQuestions: summary.totalQuestions,
      totalHintsUsed: summary.totalHintsUsed,
      totalDurationSeconds: Math.round(summary.durationMs / 1000),
      questionBreakdown: summary.questionBreakdown.map((question) => ({
        questionId: question.questionId,
        attempts: question.attempts,
        hintsUsed: question.hintsUsed,
        answeredCorrectly: question.answeredCorrectly,
      })),
      recap: summary.strengths[0] ?? "Session complete.",
    });
    await sayLines(ctx, [
      `Session complete. Score: ${summary.scorePercent} percent.`,
      `You answered ${summary.answeredCorrectly} of ${summary.totalQuestions} questions well enough to move on.`,
    ]);
  },
  async onTick(ctx) {
    ctx.memory.completed = true;
    return null;
  },
  async onChat() {
    return null;
  },
  async onExit() {},
});
