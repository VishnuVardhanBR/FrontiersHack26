import { SessionQuestionResult, TutorStateName } from "../contracts.js";
import { AnswerEvaluation } from "../tutor/answer-evaluator.js";

interface QuestionAttemptState {
  attempts: number;
  hintsUsed: number;
  startedAt: number;
  answeredCorrectly: boolean;
  matchedKeywords: string[];
  answer?: string;
  finishedAt?: number;
}

export class SessionTracker {
  readonly startedAt = Date.now();
  private readonly states: TutorStateName[] = [];
  private readonly questions = new Map<string, QuestionAttemptState>();

  constructor(readonly sessionId: string) {}

  markState(state: TutorStateName): void {
    this.states.push(state);
  }

  beginQuestion(questionId: string): void {
    if (!this.questions.has(questionId)) {
      this.questions.set(questionId, {
        attempts: 0,
        hintsUsed: 0,
        startedAt: Date.now(),
        answeredCorrectly: false,
        matchedKeywords: [],
      });
    }
  }

  recordHint(questionId: string): void {
    const question = this.questions.get(questionId);
    if (question) {
      question.hintsUsed += 1;
    }
  }

  recordAnswer(questionId: string, answer: string, evaluation: AnswerEvaluation): SessionQuestionResult {
    const question = this.questions.get(questionId) ?? {
      attempts: 0,
      hintsUsed: 0,
      startedAt: Date.now(),
      answeredCorrectly: false,
      matchedKeywords: [],
    };

    question.attempts += 1;
    question.answer = answer;
    question.matchedKeywords = evaluation.matchedKeywords;
    question.answeredCorrectly = evaluation.matched;
    if (evaluation.shouldAdvance) {
      question.finishedAt = Date.now();
    }

    this.questions.set(questionId, question);

    return {
      questionId,
      attempts: question.attempts,
      hintsUsed: question.hintsUsed,
      answeredCorrectly: question.answeredCorrectly,
      matchedKeywords: question.matchedKeywords,
      answer,
      elapsedMs: (question.finishedAt ?? Date.now()) - question.startedAt,
    };
  }

  finalizeQuestion(questionId: string): SessionQuestionResult | null {
    const question = this.questions.get(questionId);
    if (!question) {
      return null;
    }

    question.finishedAt ??= Date.now();
    return {
      questionId,
      attempts: question.attempts,
      hintsUsed: question.hintsUsed,
      answeredCorrectly: question.answeredCorrectly,
      matchedKeywords: question.matchedKeywords,
      answer: question.answer,
      elapsedMs: question.finishedAt - question.startedAt,
    };
  }

  getQuestionBreakdown(): SessionQuestionResult[] {
    return [...this.questions.entries()].map(([questionId, state]) => ({
      questionId,
      attempts: state.attempts,
      hintsUsed: state.hintsUsed,
      answeredCorrectly: state.answeredCorrectly,
      matchedKeywords: state.matchedKeywords,
      answer: state.answer,
      elapsedMs: (state.finishedAt ?? Date.now()) - state.startedAt,
    }));
  }

  getDurationMs(): number {
    return Date.now() - this.startedAt;
  }

  getVisitedStates(): TutorStateName[] {
    return [...this.states];
  }
}
