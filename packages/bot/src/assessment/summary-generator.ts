import { ExperiencePackage, SessionSummary } from "../contracts.js";
import { SessionTracker } from "./session-tracker.js";

export class SummaryGenerator {
  generate(experience: ExperiencePackage, tracker: SessionTracker): SessionSummary {
    const breakdown = tracker.getQuestionBreakdown();
    const answeredCorrectly = breakdown.filter((question) => question.answeredCorrectly).length;
    const totalHintsUsed = breakdown.reduce((total, question) => total + question.hintsUsed, 0);
    const totalQuestions = Math.max(breakdown.length, experience.questionPlan.length);
    const scorePercent = totalQuestions === 0 ? 100 : Math.round((answeredCorrectly / totalQuestions) * 100);

    const strengths =
      answeredCorrectly > 0
        ? [
            `You connected ${answeredCorrectly} key ideas to the scene.`,
            `You stayed with the story for ${Math.round(tracker.getDurationMs() / 1000)} seconds of guided exploration.`,
          ]
        : ["You completed the walkthrough and saw the main historical setting from start to finish."];

    const nextSteps =
      totalQuestions > answeredCorrectly
        ? [
            "Review the cause-and-effect moments from the chapter.",
            "Retell the scene in order using your own words.",
          ]
        : ["Try teaching the chapter events back to someone else from memory."];

    return {
      scorePercent,
      totalQuestions,
      answeredCorrectly,
      totalHintsUsed,
      durationMs: tracker.getDurationMs(),
      strengths,
      nextSteps,
      questionBreakdown: breakdown,
    };
  }
}
