import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { log, warn } from "./log.js";

import { BotManager } from "./bot-manager.js";
import { BotConfig } from "./config.js";
import { SessionEvent, SessionState, TutorStateName } from "./contracts.js";
import { SessionTracker } from "./assessment/session-tracker.js";
import { SummaryGenerator } from "./assessment/summary-generator.js";
import { SceneBuilder } from "./builder/scene-builder.js";
import { EscortController } from "./navigation/escort.js";
import { PlayerTracker } from "./navigation/player-tracker.js";
import { TriggerMonitor } from "./navigation/trigger-monitor.js";
import { TutorFSM } from "./fsm/tutor-fsm.js";
import type { TutorContext } from "./fsm/tutor-fsm.js";
import {
  createAskQuestionState,
  createBuildSceneState,
  createClimaxRecapState,
  createEndSessionState,
  createEscortToRegionState,
  createEvaluateAnswerState,
  createIdleState,
  createIntroduceState,
  createMonitorObjectiveState,
  createNarrateState,
  createWaitForPlayerState,
} from "./fsm/transitions.js";
import { HintManager } from "./tutor/hint-manager.js";
import { Narrator } from "./tutor/narrator.js";
import { QuestionAsker } from "./tutor/question-asker.js";
import { AnswerEvaluator } from "./tutor/answer-evaluator.js";
import { SessionFileRepository } from "./storage/session-file-repository.js";

export interface SessionRunnerOptions {
  repository: SessionFileRepository;
  manager: BotManager;
  config: BotConfig;
}

export class SessionRunner {
  private readonly narrator = new Narrator();
  private readonly questionAsker = new QuestionAsker(this.narrator);
  private readonly evaluator = new AnswerEvaluator();
  private readonly hintManager = new HintManager();
  private readonly summaryGenerator = new SummaryGenerator();
  private readonly sceneBuilder = new SceneBuilder();
  private readonly activeSessions = new Set<string>();

  constructor(private readonly options: SessionRunnerOptions) {}

  async tryRun(session: SessionState): Promise<boolean> {
    if (this.activeSessions.has(session.id)) {
      return false;
    }

    const claimed = await this.options.repository.claim(session.id, this.options.config.botUsername);
    if (!claimed) {
      return false;
    }

    log("session", `claimed ${session.id} — "${session.experiencePackage?.title ?? "untitled"}"`);
    this.activeSessions.add(session.id);

    void this.runClaimedSession(claimed)
      .catch((error) => {
        warn("session", `run failed for ${session.id}`, error);
      })
      .finally(() => {
        this.activeSessions.delete(session.id);
      });

    return true;
  }

  private async runClaimedSession(session: SessionState): Promise<void> {
    let currentSession = session;
    let ctx: TutorContext | null = null;
    let fsm: TutorFSM | null = null;
    let onChat: ((username: string, message: string) => void) | null = null;
    let stopVoicePoll: (() => void) | null = null;
    let writeQueue: Promise<void> = Promise.resolve();
    let errorPersisted = false;

    const enqueueSessionWrite = async <T>(task: () => Promise<T>): Promise<T> => {
      const run = writeQueue.then(task, task);
      writeQueue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    };

    const persistErrorOnce = async (error: unknown, stateName?: TutorStateName): Promise<void> => {
      if (errorPersisted) {
        return;
      }
      errorPersisted = true;

      const latest = ctx?.session ?? currentSession;
      if (latest.status === "error") {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      const errored: SessionState = {
        ...latest,
        status: "error",
        errorMessage: message,
        runtime: {
          ...latest.runtime,
          currentState: stateName ?? latest.runtime?.currentState ?? "IDLE",
        },
      };

      currentSession = errored;
      if (ctx) {
        ctx.session = errored;
        ctx.memory.completed = true;
      }

      await enqueueSessionWrite(async () => {
        await this.options.repository.save(errored);
        const at = new Date().toISOString();
        const state = stateName ?? errored.runtime?.currentState ?? "IDLE";
        await this.options.repository.appendEvent({
          type: "error",
          sessionId: errored.id,
          at,
          payload: {
            state,
            message,
          },
        });
        await this.options.repository.appendEvent({
          type: "status",
          sessionId: errored.id,
          at,
          payload: {
            status: "error",
            message,
          },
        });
      });
    };

    try {
      const bot = await this.options.manager.connect();
      await this.options.manager.ensureCreativeMode();

      const tracker = new SessionTracker(session.id);
      const playerTracker = new PlayerTracker(bot);
      const escort = new EscortController(bot, {
        routeRadius: this.options.config.routeRadius,
      });
      const triggerMonitor = new TriggerMonitor();

      const appendSessionEvent = async (type: SessionEvent["type"], payload: Record<string, unknown>) => {
        await enqueueSessionWrite(async () => {
          await this.options.repository.appendEvent({
            type,
            sessionId: session.id,
            at: new Date().toISOString(),
            payload,
          });
        });
      };

      const persistSessionState = async (updates: Partial<SessionState>, stateName?: TutorStateName) => {
        await enqueueSessionWrite(async () => {
          if (!ctx) {
            return;
          }
          ctx.session = {
            ...ctx.session,
            ...updates,
            runtime: {
              ...ctx.session.runtime,
              ...(updates.runtime ?? {}),
              currentState: stateName ?? updates.runtime?.currentState ?? ctx.session.runtime?.currentState,
            },
          };
          currentSession = ctx.session;
          await this.options.repository.save(ctx.session);
        });
      };

      const appendChatMessage = async (
        speaker: "bot" | "student" | "system",
        username: string,
        message: string,
      ): Promise<void> => {
        await enqueueSessionWrite(async () => {
          if (!ctx) {
            return;
          }
          const entry = {
            id: randomUUID(),
            speaker,
            username,
            message,
            timestamp: new Date().toISOString(),
          } as const;

          ctx.session = {
            ...ctx.session,
            chatLog: [...(ctx.session.chatLog ?? []), entry],
          };
          currentSession = ctx.session;
          await this.options.repository.save(ctx.session);
          await this.options.repository.appendEvent({
            type: "chat",
            sessionId: session.id,
            at: new Date().toISOString(),
            payload: entry,
          });
        });
      };

      ctx = {
        bot,
        session,
        repository: this.options.repository,
        tracker,
        narrator: this.narrator,
        questionAsker: this.questionAsker,
        evaluator: this.evaluator,
        hintManager: this.hintManager,
        sceneBuilder: this.sceneBuilder,
        playerTracker,
        escort,
        triggerMonitor,
        summaryGenerator: this.summaryGenerator,
        config: this.options.config,
        lastChatMessage: null as { username: string; message: string } | null,
        memory: {
          regionIndex: 0,
          stateEnteredAt: Date.now(),
          pendingAnswer: null,
          recapAnswer: null,
          lastEvaluation: null,
          buildInFlight: false,
          buildComplete: false,
          questionHintGiven: false,
          questionAttempts: {},
          objectiveHintCount: 0,
          recapAsked: false,
          completed: false,
          selectedPlayer: session.runtime?.selectedPlayer,
        },
        emitEvent: appendSessionEvent,
        persistState: persistSessionState,
        appendChatMessage,
      };

      fsm = new TutorFSM(
        {
          IDLE: createIdleState(),
          BUILD_SCENE: createBuildSceneState(),
          WAIT_FOR_PLAYER: createWaitForPlayerState(),
          INTRODUCE: createIntroduceState(),
          ESCORT_TO_REGION: createEscortToRegionState(),
          NARRATE: createNarrateState(),
          ASK_QUESTION: createAskQuestionState(),
          EVALUATE_ANSWER: createEvaluateAnswerState(),
          MONITOR_OBJECTIVE: createMonitorObjectiveState(),
          CLIMAX_RECAP: createClimaxRecapState(),
          END_SESSION: createEndSessionState(),
        },
        "IDLE",
        ctx,
        this.options.config.tickIntervalMs,
      );

      onChat = (username: string, message: string) => {
        if (!ctx || !fsm) {
          return;
        }
        void (async () => {
          ctx.lastChatMessage = { username, message };
          await ctx.appendChatMessage("student", username, message);
          await fsm.handleChat(username, message);
        })().catch((error) => {
          void persistErrorOnce(error, ctx?.session.runtime?.currentState);
        });
      };

      this.options.manager.on("chat", onChat);
      stopVoicePoll = this.startVoicePoll(session.id, ctx, fsm, async (error) => {
        await persistErrorOnce(error, ctx?.session.runtime?.currentState);
      });

      log("session", `starting FSM for ${session.id}`);
      await fsm.start();
      while (!fsm.isCompleted()) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const fatalError = fsm.getFatalError();
      if (fatalError) {
        await persistErrorOnce(fatalError, ctx.session.runtime?.currentState);
      }

      if (ctx.session.status === "error") {
        warn("session", `completed with error ${session.id}`);
      } else {
        log("session", `completed ${session.id}`);
      }
    } catch (error) {
      await persistErrorOnce(error, ctx?.session.runtime?.currentState);
    } finally {
      stopVoicePoll?.();
      if (onChat) {
        this.options.manager.off("chat", onChat);
      }
      if (fsm) {
        await fsm.stop().catch((error) => {
          warn("session", `failed to stop fsm for ${session.id}`, error);
        });
      }
      await writeQueue;
    }
  }

  private startVoicePoll(
    sessionId: string,
    ctx: TutorContext,
    fsm: TutorFSM,
    onError?: (error: unknown) => Promise<void> | void,
  ): () => void {
    const voicePendingPath = path.join(this.options.config.storageRoot, sessionId, "voice-pending.txt");
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          const transcript = await fs.readFile(voicePendingPath, "utf8");
          await fs.unlink(voicePendingPath);
          const username = ctx.memory.selectedPlayer ?? ctx.config.botUsername;
          log("voice", `transcript from ${username}: "${transcript.trim().slice(0, 80)}"`);
          await fsm.handleChat(username, transcript.trim());
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            warn("voice", `poll failed for ${sessionId}`, error);
            try {
              await onError?.(error);
            } catch (onErrorFailure) {
              warn("voice", `poll error handler failed for ${sessionId}`, onErrorFailure);
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };

    void poll();
    return () => {
      stopped = true;
    };
  }
}
