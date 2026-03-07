import type { Bot } from "mineflayer";

import { BotConfig } from "../config.js";
import { SessionEvent, SessionState, ChatMessage, TutorStateName } from "../contracts.js";
import { SessionFileRepository } from "../storage/session-file-repository.js";
import { SessionTracker } from "../assessment/session-tracker.js";
import { SummaryGenerator } from "../assessment/summary-generator.js";
import { SceneBuilder } from "../builder/scene-builder.js";
import { PlayerTracker } from "../navigation/player-tracker.js";
import { EscortController } from "../navigation/escort.js";
import { TriggerMonitor } from "../navigation/trigger-monitor.js";
import { Narrator } from "../tutor/narrator.js";
import { QuestionAsker } from "../tutor/question-asker.js";
import { AnswerEvaluation, AnswerEvaluator } from "../tutor/answer-evaluator.js";
import { HintManager } from "../tutor/hint-manager.js";

export interface StateTransition {
  to: TutorStateName;
  patch?: Partial<TutorMemory>;
}

export interface TutorMemory {
  regionIndex: number;
  stateEnteredAt: number;
  selectedPlayer?: string | undefined;
  pendingAnswer?: ChatMessage | null;
  recapAnswer?: ChatMessage | null;
  lastEvaluation?: AnswerEvaluation | null;
  currentQuestionId?: string | undefined;
  buildInFlight: boolean;
  buildComplete: boolean;
  introStartedAt?: number | undefined;
  questionHintGiven: boolean;
  questionAttempts: Record<string, number>;
  objectiveHintCount: number;
  objectiveStartedAt?: number | undefined;
  recapAsked: boolean;
  completed: boolean;
  /** Set by FSM so onTick is skipped until onEnter completes (prevents duplicate dialogue). */
  onEnterInProgress?: boolean;
  /** Region IDs already narrated (avoid re-delivery). */
  narratedRegionIds?: string[];
  /** Aqua Roma: when puzzle conditions first became true (for debounce). */
  aquaPuzzleSatisfiedAt?: number;
  /** Aqua Roma: hint given for block. */
  aquaRepairHintGiven?: boolean;
  /** Aqua Roma: hint given for lever. */
  aquaLeverHintGiven?: boolean;
}

export interface TutorContext {
  bot: Bot;
  session: SessionState;
  repository: SessionFileRepository;
  tracker: SessionTracker;
  narrator: Narrator;
  questionAsker: QuestionAsker;
  evaluator: AnswerEvaluator;
  hintManager: HintManager;
  sceneBuilder: SceneBuilder;
  playerTracker: PlayerTracker;
  escort: EscortController;
  triggerMonitor: TriggerMonitor;
  summaryGenerator: SummaryGenerator;
  config: BotConfig;
  lastChatMessage: ChatMessage | null;
  emitEvent: (type: SessionEvent["type"], payload: Record<string, unknown>) => Promise<void>;
  persistState: (updates: Partial<SessionState>, stateName?: TutorStateName) => Promise<void>;
  appendChatMessage: (speaker: "bot" | "student" | "system", username: string, message: string) => Promise<void>;
  memory: TutorMemory;
}

export interface TutorState {
  name: TutorStateName;
  onEnter(ctx: TutorContext): Promise<void>;
  onTick(ctx: TutorContext): Promise<StateTransition | null>;
  onChat(ctx: TutorContext, username: string, message: string): Promise<StateTransition | null>;
  onExit(ctx: TutorContext): Promise<void>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STATUS_BY_STATE: Record<TutorStateName, string> = {
  IDLE: "queued",
  BUILD_SCENE: "building_scene",
  WAIT_FOR_PLAYER: "waiting_for_player",
  INTRODUCE: "introducing",
  ESCORT_TO_REGION: "escorting",
  NARRATE: "narrating",
  ASK_QUESTION: "asking_question",
  EVALUATE_ANSWER: "evaluating_answer",
  MONITOR_OBJECTIVE: "monitoring_objective",
  CLIMAX_RECAP: "climax_recap",
  END_SESSION: "completed",
  ALEX_INTRO: "introducing",
  ALEX_SHELVES: "narrating",
  ALEX_PEDESTAL_INTRO: "narrating",
  ALEX_WAIT_SCROLL: "monitoring_objective",
  ALEX_SUCCESS: "narrating",
  ALEX_OUTRO: "climax_recap",
};

export class TutorFSM {
  private currentStateName: TutorStateName;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly states: Record<TutorStateName, TutorState>,
    initialState: TutorStateName,
    private readonly ctx: TutorContext,
    private readonly tickIntervalMs: number,
  ) {
    this.currentStateName = initialState;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    await this.enterState(this.currentStateName);
    this.timer = setInterval(() => {
      void this.enqueue(async () => {
        if (!this.running || this.ctx.memory.completed) {
          return;
        }
        if (this.ctx.memory.onEnterInProgress) {
          return;
        }

        const transition = await this.states[this.currentStateName].onTick(this.ctx);
        if (transition) {
          await this.applyTransition(transition);
        }

        if (this.ctx.memory.completed) {
          this.running = false;
        }
      });
    }, this.tickIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.queue;
  }

  isCompleted(): boolean {
    return this.ctx.memory.completed;
  }

  async handleChat(username: string, message: string): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.enqueue(async () => {
      const transition = await this.states[this.currentStateName].onChat(this.ctx, username, message);
      if (transition) {
        await this.applyTransition(transition);
      }
    });
  }

  private async enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch((error) => {
      console.error("[bot] fsm error", error);
    });
    await this.queue;
  }

  private async applyTransition(transition: StateTransition): Promise<void> {
    await this.states[this.currentStateName].onExit(this.ctx);
    if (transition.patch) {
      this.ctx.memory = {
        ...this.ctx.memory,
        ...transition.patch,
      };
    }

    this.currentStateName = transition.to;
    const nextStatus = STATUS_BY_STATE[transition.to];
    await this.ctx.persistState(
      {
        status: nextStatus,
        runtime: {
          ...this.ctx.session.runtime,
          currentState: transition.to,
          currentQuestionId: this.ctx.memory.currentQuestionId,
          selectedPlayer: this.ctx.memory.selectedPlayer,
        },
      },
      transition.to,
    );
    await this.ctx.emitEvent("status", {
      status: nextStatus,
      message: `Tutor moved into ${transition.to.replaceAll("_", " ").toLowerCase()}.`,
    });
    await this.enterState(transition.to);
  }

  private async enterState(stateName: TutorStateName): Promise<void> {
    this.ctx.memory.stateEnteredAt = Date.now();
    this.ctx.memory.onEnterInProgress = true;
    this.ctx.tracker.markState(stateName);
    try {
      await this.states[stateName].onEnter(this.ctx);
    } finally {
      this.ctx.memory.onEnterInProgress = false;
    }
    await delay(10);
  }
}
