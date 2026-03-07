import { QuestionPlan } from "../contracts.js";

export class HintManager {
  getHint(question: QuestionPlan, attemptNumber: number, fallbackHints: string[]): string {
    const hints = question.hints?.filter(Boolean) ?? [];
    const questionHint = hints[Math.min(attemptNumber - 1, hints.length - 1)];
    if (questionHint) {
      return questionHint;
    }

    const fallbackHint = fallbackHints[Math.min(attemptNumber - 1, fallbackHints.length - 1)];
    return fallbackHint ?? "Look for the clearest cause or effect in what you just saw.";
  }
}
