import { QuestionPlan } from "../contracts.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const jaccard = (left: string, right: string): number => {
  const leftSet = new Set(normalize(left).split(" ").filter(Boolean));
  const rightSet = new Set(normalize(right).split(" ").filter(Boolean));
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const levenshtein = (left: string, right: string): number => {
  const a = normalize(left);
  const b = normalize(right);
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
};

const similarity = (left: string, right: string): number => {
  const distance = levenshtein(left, right);
  const maxLength = Math.max(normalize(left).length, normalize(right).length, 1);
  return 1 - distance / maxLength;
};

export interface AnswerEvaluation {
  matched: boolean;
  score: number;
  matchedKeywords: string[];
  feedback: string;
  correctAnswerSummary: string;
  shouldAdvance: boolean;
}

export class AnswerEvaluator {
  evaluate(question: QuestionPlan, answer: string, attemptNumber: number): AnswerEvaluation {
    const keywords = [...question.answerKeywords, ...(question.conceptKeywords ?? [])].filter(Boolean);
    const normalizedAnswer = normalize(answer);

    const matchedKeywords = keywords.filter((keyword) => {
      const normalizedKeyword = normalize(keyword);
      return (
        normalizedAnswer.includes(normalizedKeyword) ||
        similarity(normalizedAnswer, normalizedKeyword) >= 0.8 ||
        jaccard(normalizedAnswer, normalizedKeyword) >= 0.45
      );
    });

    const overlapScore =
      keywords.length === 0
        ? Math.min(1, normalizedAnswer.split(" ").length / 6)
        : matchedKeywords.length / keywords.length;

    const score = Number(overlapScore.toFixed(2));
    const matched = score >= 0.4 || matchedKeywords.length >= 2;

    const feedback = matched
      ? attemptNumber > 1
        ? "Nice recovery. You pulled the key idea into focus."
        : "Nice work. You caught the main idea."
      : attemptNumber >= 2
        ? "You are circling the idea. Use the hint and try the most important cause or detail."
        : "Good start. Try naming the most important cause, event, or clue from this scene.";

    return {
      matched,
      score,
      matchedKeywords,
      feedback,
      correctAnswerSummary:
        question.correctAnswerSummary ??
        (keywords.length > 0 ? `A strong answer mentions ${keywords.slice(0, 3).join(", ")}.` : "A strong answer names the main idea from the chapter."),
      shouldAdvance: matched || attemptNumber >= 3,
    };
  }
}
