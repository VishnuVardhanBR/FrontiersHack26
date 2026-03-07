import { Vec3 } from "vec3";

export type TutorStateName =
  | "IDLE"
  | "BUILD_SCENE"
  | "WAIT_FOR_PLAYER"
  | "INTRODUCE"
  | "ESCORT_TO_REGION"
  | "NARRATE"
  | "ASK_QUESTION"
  | "EVALUATE_ANSWER"
  | "MONITOR_OBJECTIVE"
  | "CLIMAX_RECAP"
  | "END_SESSION"
  // Library of Alexandria demo (scripted)
  | "ALEX_INTRO"
  | "ALEX_SHELVES"
  | "ALEX_PEDESTAL_INTRO"
  | "ALEX_WAIT_SCROLL"
  | "ALEX_SUCCESS"
  | "ALEX_OUTRO";

export interface SceneRegion {
  id: string;
  purpose: string;
  description: string;
  narration?: string;
  questionId?: string;
  center?: Vector3Like;
  radius?: number;
}

export interface StudentObjective {
  type: "find_item" | "visit_region" | "answer_final_question";
  itemName?: string;
  narrativeLabel?: string;
  placementRule?: string;
  targetRegionId?: string;
}

export interface DialogueBeat {
  id: string;
  regionId: string;
  lines: string[];
}

export interface QuestionPlan {
  id: string;
  regionId: string;
  prompt: string;
  answerKeywords: string[];
  conceptKeywords?: string[];
  hints?: string[];
  correctAnswerSummary?: string;
}

export interface ExperiencePackage {
  experienceId: string;
  title: string;
  gradeBand: string;
  durationMinutes: number;
  learningObjectives: string[];
  historicalSummary: string;
  creativeLicense: {
    enabled: boolean;
    notes: string;
  };
  sceneSpec: {
    theme: string;
    size: "small" | "medium" | "large";
    palette?: string[];
    regions: SceneRegion[];
  };
  studentObjective: StudentObjective;
  dialoguePlan: DialogueBeat[];
  questionPlan: QuestionPlan[];
  triggerPlan: string[];
  successConditions: string[];
  fallbackHints: string[];
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface BuildTemplatePlacement {
  template:
    | "flat_path"
    | "simple_house"
    | "wall_segment"
    | "sign_post"
    | "torch_line"
    | "item_chest"
    | "arch"
    | "rubble_pile";
  origin: Vector3Like;
  size?: Vector3Like;
  palette?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface BuildPlan {
  theme: string;
  clearBounds: {
    min: Vector3Like;
    max: Vector3Like;
  };
  spawnPoint: Vector3Like;
  /** When set (e.g. Alexandria demo), tutor teleports here instead of spawnPoint + 5 Z. */
  tutorSpawn?: Vector3Like;
  palette: string[];
  placements: BuildTemplatePlacement[];
  regionCenters: Record<string, Vector3Like>;
  objectivePlacement?: {
    position: Vector3Like;
    itemName: string;
    narrativeLabel?: string;
  };
}

export interface BuildSummary {
  commandCount: number;
  fillCount: number;
  setblockCount: number;
  walkabilityPassed: boolean;
}

export interface BuildProgressSnapshot {
  completedCommands: number;
  totalCommands: number;
  percent: number;
  currentStep: string;
}

export interface SessionQuestionResult {
  questionId: string;
  attempts: number;
  hintsUsed: number;
  answeredCorrectly: boolean;
  matchedKeywords: string[];
  answer?: string;
  elapsedMs: number;
}

export interface SessionSummary {
  scorePercent: number;
  totalQuestions: number;
  answeredCorrectly: number;
  totalHintsUsed: number;
  durationMs: number;
  strengths: string[];
  nextSteps: string[];
  questionBreakdown: SessionQuestionResult[];
}

export interface SessionRuntimeState {
  activeRegionId?: string;
  currentQuestionId?: string | undefined;
  currentState?: TutorStateName;
  buildProgress?: number;
  selectedPlayer?: string | undefined;
  itemFound?: boolean;
  attempts?: Record<string, number>;
}

export interface TeacherSettings {
  gradeLevel?: string;
  topic?: string;
  questionCount?: number;
}

export interface SessionState {
  id: string;
  status: string;
  teacherSettings?: TeacherSettings;
  uploadedText?: string;
  experiencePackage: ExperiencePackage;
  buildPlan?: BuildPlan;
  buildSummary?: BuildSummary;
  buildProgress?: BuildProgressSnapshot;
  runtime?: SessionRuntimeState;
  summary?: SessionSummary;
  chatLog?: Array<{
    id: string;
    speaker: "bot" | "student" | "system";
    username: string;
    message: string;
    timestamp: string;
  }>;
  claimedBy?: string;
  claimedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionEvent {
  type:
    | "status"
    | "build_progress"
    | "chat"
    | "question_result"
    | "session_complete"
    | "error";
  sessionId: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface BlockPlacement {
  x: number;
  y: number;
  z: number;
  block: string;
  nbt?: string;
}

export interface ChatMessage {
  username: string;
  message: string;
}

const defaultExperience: ExperiencePackage = {
  experienceId: "quizcraft-demo",
  title: "Historical Walkthrough",
  gradeBand: "middle_school",
  durationMinutes: 6,
  learningObjectives: [
    "Recall the key event",
    "Connect the environment to the chapter facts",
    "Answer questions during exploration",
  ],
  historicalSummary: "A short historical learning scene generated from chapter text.",
  creativeLicense: {
    enabled: true,
    notes: "The world uses symbolic Minecraft-friendly representations.",
  },
  sceneSpec: {
    theme: "Historical settlement under pressure",
    size: "medium",
    palette: ["minecraft:stone_bricks", "minecraft:oak_planks", "minecraft:gravel"],
    regions: [
      {
        id: "entry",
        purpose: "introduction",
        description: "Entry street with signs of the chapter setting.",
      },
      {
        id: "midpoint",
        purpose: "context",
        description: "Central region for story detail.",
      },
      {
        id: "climax",
        purpose: "climax",
        description: "Final region for recap and objective reveal.",
      },
    ],
  },
  studentObjective: {
    type: "find_item",
    itemName: "diamond",
    narrativeLabel: "preserved artifact",
    placementRule: "reachable near the final region",
    targetRegionId: "climax",
  },
  dialoguePlan: [],
  questionPlan: [],
  triggerPlan: [],
  successConditions: ["Complete the guided route", "Answer the questions", "Find the objective item"],
  fallbackHints: ["Look closely around the final area.", "Think about what caused the main historical event."],
};

export const asVec3 = (value: Vector3Like): Vec3 => new Vec3(value.x, value.y, value.z);

export const withTimestamp = <T extends object>(value: T): T & { updatedAt: string } => ({
  ...value,
  updatedAt: new Date().toISOString(),
});

const normalizeRegion = (region: Partial<SceneRegion>, index: number): SceneRegion => ({
  id: region.id ?? `region-${index + 1}`,
  purpose: region.purpose ?? (index === 0 ? "introduction" : index === 2 ? "climax" : "context"),
  description: region.description ?? `Historical region ${index + 1}`,
  narration: region.narration,
  questionId: region.questionId,
  center: region.center,
  radius: region.radius,
});

export const normalizeExperiencePackage = (input: unknown): ExperiencePackage => {
  const raw = (typeof input === "object" && input ? input : {}) as Record<string, unknown>;
  const sceneSpec = (raw.sceneSpec ?? {}) as Record<string, unknown>;
  const regions = Array.isArray(sceneSpec.regions)
    ? sceneSpec.regions.map((region, index) => normalizeRegion(region as Partial<SceneRegion>, index))
    : defaultExperience.sceneSpec.regions;

  return {
    experienceId: String(raw.experienceId ?? raw.experience_id ?? defaultExperience.experienceId),
    title: String(raw.title ?? defaultExperience.title),
    gradeBand: String(raw.gradeBand ?? raw.grade_band ?? defaultExperience.gradeBand),
    durationMinutes: Number(raw.durationMinutes ?? raw.duration_minutes ?? defaultExperience.durationMinutes),
    learningObjectives: Array.isArray(raw.learningObjectives)
      ? raw.learningObjectives.map(String)
      : defaultExperience.learningObjectives,
    historicalSummary: String(raw.historicalSummary ?? raw.historical_summary ?? defaultExperience.historicalSummary),
    creativeLicense: {
      enabled: Boolean(
        ((raw.creativeLicense ?? raw.creative_license) as { enabled?: boolean } | undefined)?.enabled ??
          defaultExperience.creativeLicense.enabled,
      ),
      notes: String(
        ((raw.creativeLicense ?? raw.creative_license) as { notes?: string } | undefined)?.notes ??
          defaultExperience.creativeLicense.notes,
      ),
    },
    sceneSpec: {
      theme: String(sceneSpec.theme ?? defaultExperience.sceneSpec.theme),
      size:
        sceneSpec.size === "small" || sceneSpec.size === "large" || sceneSpec.size === "medium"
          ? sceneSpec.size
          : defaultExperience.sceneSpec.size,
      palette: Array.isArray(sceneSpec.palette)
        ? sceneSpec.palette.map(String)
        : defaultExperience.sceneSpec.palette,
      regions,
    },
    studentObjective: {
      type:
        ((raw.studentObjective ?? raw.student_objective) as StudentObjective | undefined)?.type ??
        defaultExperience.studentObjective.type,
      itemName:
        ((raw.studentObjective ?? raw.student_objective) as StudentObjective | undefined)?.itemName ??
        defaultExperience.studentObjective.itemName,
      narrativeLabel:
        ((raw.studentObjective ?? raw.student_objective) as StudentObjective | undefined)?.narrativeLabel ??
        defaultExperience.studentObjective.narrativeLabel,
      placementRule:
        ((raw.studentObjective ?? raw.student_objective) as StudentObjective | undefined)?.placementRule ??
        defaultExperience.studentObjective.placementRule,
      targetRegionId:
        ((raw.studentObjective ?? raw.student_objective) as StudentObjective | undefined)?.targetRegionId ??
        defaultExperience.studentObjective.targetRegionId,
    },
    dialoguePlan: Array.isArray(raw.dialoguePlan)
      ? raw.dialoguePlan.map((beat, index) => {
          const item = beat as Partial<DialogueBeat>;
          return {
            id: item.id ?? `dialogue-${index + 1}`,
            regionId: item.regionId ?? item.regionId ?? regions[Math.min(index, regions.length - 1)]?.id ?? "entry",
            lines: Array.isArray(item.lines) ? item.lines.map(String) : [String((beat as { text?: string }).text ?? "")],
          };
        })
      : [],
    questionPlan: Array.isArray(raw.questionPlan)
      ? raw.questionPlan.map((question, index) => {
          const item = question as Partial<QuestionPlan>;
          return {
            id: item.id ?? `question-${index + 1}`,
            regionId: item.regionId ?? regions[Math.min(index, regions.length - 1)]?.id ?? "entry",
            prompt: String(item.prompt ?? `What stands out to you in this part of the story?`),
            answerKeywords: Array.isArray(item.answerKeywords)
              ? item.answerKeywords.map(String)
              : Array.isArray((question as { acceptableAnswers?: unknown[] }).acceptableAnswers)
                ? ((question as { acceptableAnswers?: unknown[] }).acceptableAnswers ?? []).map(String)
              : Array.isArray((question as { answer_keywords?: unknown[] }).answer_keywords)
                ? ((question as { answer_keywords?: unknown[] }).answer_keywords ?? []).map(String)
                : [],
            conceptKeywords: Array.isArray(item.conceptKeywords)
              ? item.conceptKeywords.map(String)
              : Array.isArray((question as { concepts?: unknown[] }).concepts)
                ? ((question as { concepts?: unknown[] }).concepts ?? []).map(String)
                : [],
            hints: Array.isArray(item.hints) ? item.hints.map(String) : [],
            correctAnswerSummary:
              item.correctAnswerSummary ??
              (typeof (question as { explanation?: unknown }).explanation === "string"
                ? String((question as { explanation?: string }).explanation)
                : undefined),
          };
        })
      : [],
    triggerPlan: Array.isArray(raw.triggerPlan)
      ? raw.triggerPlan.map((trigger) =>
          typeof trigger === "string"
            ? trigger
            : String((trigger as { condition?: string }).condition ?? "runtime trigger"),
        )
      : [],
    successConditions: Array.isArray(raw.successConditions)
      ? raw.successConditions.map((condition) =>
          typeof condition === "string"
            ? condition
            : String((condition as { description?: string }).description ?? "success condition"),
        )
      : defaultExperience.successConditions,
    fallbackHints: Array.isArray(raw.fallbackHints) ? raw.fallbackHints.map(String) : defaultExperience.fallbackHints,
  };
};

export const normalizeSessionState = (input: unknown, idHint = "session"): SessionState => {
  const raw = (typeof input === "object" && input ? input : {}) as Record<string, unknown>;
  const experiencePackage = normalizeExperiencePackage(
    raw.experiencePackage ?? raw.experience ?? raw.experience_package ?? raw.package ?? defaultExperience,
  );

  return {
    id: String(raw.id ?? raw.sessionId ?? idHint),
    status: String(raw.status ?? "queued"),
    teacherSettings:
      raw.teacherOptions && typeof raw.teacherOptions === "object"
        ? (raw.teacherOptions as TeacherSettings)
        : raw.teacherSettings && typeof raw.teacherSettings === "object"
          ? (raw.teacherSettings as TeacherSettings)
          : undefined,
    uploadedText:
      typeof raw.uploadedText === "string"
        ? raw.uploadedText
        : typeof raw.sourceExcerpt === "string"
          ? raw.sourceExcerpt
          : undefined,
    experiencePackage,
    buildPlan: raw.buildPlan as BuildPlan | undefined,
    buildSummary: raw.buildSummary as BuildSummary | undefined,
    buildProgress:
      raw.buildProgress && typeof raw.buildProgress === "object"
        ? (raw.buildProgress as BuildProgressSnapshot)
        : undefined,
    runtime: {
      ...(raw.runtime as SessionRuntimeState | undefined),
      buildProgress:
        typeof ((raw.buildProgress as { percent?: unknown } | undefined)?.percent) === "number"
          ? Number((raw.buildProgress as { percent: number }).percent)
          : typeof (raw.runtime as SessionRuntimeState | undefined)?.buildProgress === "number"
            ? (raw.runtime as SessionRuntimeState | undefined)?.buildProgress
            : undefined,
    },
    summary: raw.summary as SessionSummary | undefined,
    chatLog: Array.isArray(raw.chatLog)
      ? (raw.chatLog as SessionState["chatLog"])
      : Array.isArray(raw.chat_log)
        ? (raw.chat_log as SessionState["chatLog"])
        : [],
    claimedBy: typeof raw.claimedBy === "string" ? raw.claimedBy : undefined,
    claimedAt: typeof raw.claimedAt === "string" ? raw.claimedAt : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
};
