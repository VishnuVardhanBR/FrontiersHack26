export type SessionSpeaker = 'bot' | 'student' | 'system' | 'teacher';

export interface LearningObjective {
  id?: string;
  text: string;
}

export interface RegionSpec {
  id: string;
  purpose?: string;
  description: string;
}

export interface StudentObjective {
  type?: string;
  itemName?: string;
  narrativeLabel?: string;
  placementRule?: string;
}

export interface QuestionPlanItem {
  id?: string;
  prompt: string;
  acceptableAnswers?: string[];
  hints?: string[];
}

export interface ExperiencePackage {
  experienceId?: string;
  title: string;
  gradeBand?: string;
  durationMinutes?: number;
  historicalSummary?: string;
  learningObjectives?: LearningObjective[];
  studentObjective?: StudentObjective;
  sceneSpec?: {
    theme?: string;
    size?: string;
    regions?: RegionSpec[];
  };
  questionPlan?: QuestionPlanItem[];
}

export interface QuestionBreakdown {
  id?: string;
  prompt: string;
  attempts?: number;
  hintsUsed?: number;
  correct?: boolean;
  feedback?: string;
}

export interface SessionSummaryData {
  scorePercent?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  totalAttempts?: number;
  hintsUsed?: number;
  completionTimeSeconds?: number;
  recap?: string;
  objectiveFound?: boolean;
  breakdown?: QuestionBreakdown[];
}

export interface ChatEntry {
  id: string;
  speaker: SessionSpeaker;
  message: string;
  timestamp: string;
  phase?: string;
}

export interface SessionRecord {
  id: string;
  status: string;
  currentState?: string;
  buildProgress?: number;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  experiencePackage?: ExperiencePackage;
  summary?: SessionSummaryData;
  chatLog: ChatEntry[];
}

export interface UploadFormValues {
  file: File | null;
  gradeBand: string;
  topic: string;
  questionCount: number;
  objectiveEmphasis: string;
}

export interface UploadResponse {
  sessionId: string;
  session?: SessionRecord;
}

export interface StreamEnvelope<T = unknown> {
  id: string;
  sessionId?: string;
  type: string;
  timestamp: string;
  message?: string;
  payload?: T;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item : undefined))
    .filter((item): item is string => Boolean(item));
};

export const humanize = (value: string | undefined, fallback = 'Awaiting update') => {
  if (!value) {
    return fallback;
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const normalizeChatEntry = (value: unknown, fallbackSpeaker: SessionSpeaker = 'system'): ChatEntry => {
  if (!isRecord(value)) {
    return {
      id: crypto.randomUUID(),
      speaker: fallbackSpeaker,
      message: typeof value === 'string' ? value : 'Session updated',
      timestamp: new Date().toISOString(),
    };
  }

  const speaker = value.speaker;
  const timestamp = typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString();

  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    speaker:
      speaker === 'bot' || speaker === 'student' || speaker === 'teacher' || speaker === 'system'
        ? speaker
        : fallbackSpeaker,
    message:
      typeof value.message === 'string'
        ? value.message
        : typeof value.text === 'string'
          ? value.text
          : 'Session updated',
    timestamp,
    phase: typeof value.phase === 'string' ? value.phase : undefined,
  };
};

export const normalizeSummary = (value: unknown): SessionSummaryData | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawBreakdown = Array.isArray(value.breakdown)
    ? value.breakdown
    : Array.isArray(value.questionBreakdown)
      ? value.questionBreakdown
    : Array.isArray(value.questions)
      ? value.questions
      : [];

  return {
    scorePercent: toNumber(value.scorePercent ?? value.score ?? value.percentCorrect),
    correctAnswers: toNumber(value.correctAnswers ?? value.correct),
    totalQuestions: toNumber(value.totalQuestions ?? value.questionCount),
    totalAttempts: toNumber(value.totalAttempts ?? value.attempts),
    hintsUsed: toNumber(value.hintsUsed ?? value.totalHints ?? value.totalHintsUsed),
    completionTimeSeconds: toNumber(
      value.completionTimeSeconds ?? value.durationSeconds ?? value.totalDurationSeconds,
    ),
    recap: typeof value.recap === 'string' ? value.recap : typeof value.summary === 'string' ? value.summary : undefined,
    objectiveFound: typeof value.objectiveFound === 'boolean' ? value.objectiveFound : undefined,
    breakdown: rawBreakdown
      .filter(isRecord)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : undefined,
        prompt:
          typeof item.prompt === 'string'
            ? item.prompt
            : typeof item.question === 'string'
              ? item.question
              : 'Question',
        attempts: toNumber(item.attempts),
        hintsUsed: toNumber(item.hintsUsed),
        correct:
          typeof item.correct === 'boolean'
            ? item.correct
            : typeof item.answeredCorrectly === 'boolean'
              ? item.answeredCorrectly
              : undefined,
        feedback:
          typeof item.feedback === 'string'
            ? item.feedback
            : typeof item.explanation === 'string'
              ? item.explanation
              : undefined,
      })),
  };
};

export const normalizeExperiencePackage = (value: unknown): ExperiencePackage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawObjectives = Array.isArray(value.learningObjectives)
    ? value.learningObjectives
    : Array.isArray(value.learning_objectives)
      ? value.learning_objectives
      : [];
  const rawRegions = isRecord(value.sceneSpec)
    ? value.sceneSpec.regions
    : isRecord(value.scene_spec)
      ? value.scene_spec.regions
      : undefined;
  const rawQuestions = Array.isArray(value.questionPlan)
    ? value.questionPlan
    : Array.isArray(value.question_plan)
      ? value.question_plan
      : [];

  return {
    experienceId:
      typeof value.experienceId === 'string'
        ? value.experienceId
        : typeof value.experience_id === 'string'
          ? value.experience_id
          : undefined,
    title: typeof value.title === 'string' ? value.title : 'Untitled experience',
    gradeBand:
      typeof value.gradeBand === 'string'
        ? value.gradeBand
        : typeof value.grade_band === 'string'
          ? value.grade_band
          : undefined,
    durationMinutes: toNumber(value.durationMinutes ?? value.duration_minutes),
    historicalSummary:
      typeof value.historicalSummary === 'string'
        ? value.historicalSummary
        : typeof value.historical_summary === 'string'
          ? value.historical_summary
          : undefined,
    learningObjectives: rawObjectives.reduce<LearningObjective[]>((accumulator, item, index) => {
      if (typeof item === 'string') {
        accumulator.push({ id: `objective-${index + 1}`, text: item });
        return accumulator;
      }

      if (!isRecord(item)) {
        return accumulator;
      }

      const text =
        typeof item.text === 'string'
          ? item.text
          : typeof item.objective === 'string'
            ? item.objective
            : undefined;

      if (!text) {
        return accumulator;
      }

      accumulator.push({
        id: typeof item.id === 'string' ? item.id : `objective-${index + 1}`,
        text,
      });
      return accumulator;
    }, []),
    studentObjective: isRecord(value.studentObjective)
      ? {
          type: typeof value.studentObjective.type === 'string' ? value.studentObjective.type : undefined,
          itemName:
            typeof value.studentObjective.itemName === 'string'
              ? value.studentObjective.itemName
              : typeof value.studentObjective.item_name === 'string'
                ? value.studentObjective.item_name
                : undefined,
          narrativeLabel:
            typeof value.studentObjective.narrativeLabel === 'string'
              ? value.studentObjective.narrativeLabel
              : typeof value.studentObjective.narrative_label === 'string'
                ? value.studentObjective.narrative_label
                : undefined,
          placementRule:
            typeof value.studentObjective.placementRule === 'string'
              ? value.studentObjective.placementRule
              : typeof value.studentObjective.placement_rule === 'string'
                ? value.studentObjective.placement_rule
                : undefined,
        }
      : isRecord(value.student_objective)
        ? {
            type: typeof value.student_objective.type === 'string' ? value.student_objective.type : undefined,
            itemName:
              typeof value.student_objective.item_name === 'string' ? value.student_objective.item_name : undefined,
            narrativeLabel:
              typeof value.student_objective.narrative_label === 'string'
                ? value.student_objective.narrative_label
                : undefined,
            placementRule:
              typeof value.student_objective.placement_rule === 'string'
                ? value.student_objective.placement_rule
                : undefined,
          }
        : undefined,
    sceneSpec:
      isRecord(value.sceneSpec) || isRecord(value.scene_spec)
        ? {
            theme:
              isRecord(value.sceneSpec) && typeof value.sceneSpec.theme === 'string'
                ? value.sceneSpec.theme
                : isRecord(value.scene_spec) && typeof value.scene_spec.theme === 'string'
                  ? value.scene_spec.theme
                  : undefined,
            size:
              isRecord(value.sceneSpec) && typeof value.sceneSpec.size === 'string'
                ? value.sceneSpec.size
                : isRecord(value.scene_spec) && typeof value.scene_spec.size === 'string'
                  ? value.scene_spec.size
                  : undefined,
            regions: Array.isArray(rawRegions)
              ? rawRegions
                  .filter(isRecord)
                  .map((region, index) => ({
                    id:
                      typeof region.id === 'string'
                        ? region.id
                        : typeof region.name === 'string'
                          ? region.name
                          : `region-${index + 1}`,
                    purpose: typeof region.purpose === 'string' ? region.purpose : undefined,
                    description:
                      typeof region.description === 'string'
                        ? region.description
                        : typeof region.summary === 'string'
                          ? region.summary
                          : 'Historical landmark',
                  }))
              : [],
          }
        : undefined,
    questionPlan: rawQuestions
      .filter(isRecord)
      .map((question, index) => ({
        id: typeof question.id === 'string' ? question.id : `question-${index + 1}`,
        prompt:
          typeof question.prompt === 'string'
            ? question.prompt
            : typeof question.question === 'string'
              ? question.question
              : 'Question',
        acceptableAnswers: toStringArray(question.acceptableAnswers ?? question.acceptable_answers),
        hints: toStringArray(question.hints),
      })),
  };
};

export const normalizeSession = (value: unknown): SessionRecord => {
  if (!isRecord(value)) {
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      chatLog: [],
    };
  }

  const experience = normalizeExperiencePackage(value.experiencePackage ?? value.experience_package);
  const summary = normalizeSummary(value.summary ?? value.assessment);
  const rawChatLog = Array.isArray(value.chatLog)
    ? value.chatLog
    : Array.isArray(value.chat_log)
      ? value.chat_log
      : Array.isArray(value.messages)
        ? value.messages
        : [];

  return {
    id:
      typeof value.id === 'string'
        ? value.id
        : typeof value.sessionId === 'string'
          ? value.sessionId
          : crypto.randomUUID(),
    status:
      typeof value.status === 'string'
        ? value.status
        : typeof value.phase === 'string'
          ? value.phase
          : 'pending',
    currentState:
      typeof value.currentState === 'string'
        ? value.currentState
        : isRecord(value.runtime) && typeof value.runtime.currentState === 'string'
          ? value.runtime.currentState
        : typeof value.current_state === 'string'
          ? value.current_state
          : undefined,
    buildProgress: toNumber(
      (isRecord(value.buildProgress) ? value.buildProgress.percent : undefined)
        ?? value.buildProgress
        ?? value.build_progress
        ?? value.progress,
    ),
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : typeof value.created_at === 'string'
          ? value.created_at
          : undefined,
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : typeof value.updated_at === 'string'
          ? value.updated_at
          : undefined,
    error:
      typeof value.error === 'string'
        ? value.error
        : typeof value.errorMessage === 'string'
          ? value.errorMessage
          : undefined,
    experiencePackage: experience,
    summary,
    chatLog: rawChatLog.map((entry) => normalizeChatEntry(entry)),
  };
};

export const normalizeStreamEvent = (eventType: string, value: unknown): StreamEnvelope => {
  const record = isRecord(value) ? value : {};
  const inferredType =
    typeof record.type === 'string' ? record.type : eventType === 'message' ? 'session_update' : eventType;
  const payload =
    isRecord(record.data) || Array.isArray(record.data)
      ? record.data
      : isRecord(record.payload) || Array.isArray(record.payload)
        ? record.payload
        : record;

  return {
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    sessionId:
      typeof record.sessionId === 'string'
        ? record.sessionId
        : typeof record.session_id === 'string'
          ? record.session_id
          : undefined,
    type: inferredType,
    timestamp:
      typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString(),
    message:
      typeof record.message === 'string'
        ? record.message
        : isRecord(record.data) && typeof record.data.message === 'string'
          ? record.data.message
        : typeof record.text === 'string'
          ? record.text
          : undefined,
    payload,
  };
};
