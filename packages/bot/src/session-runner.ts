import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Bot } from "mineflayer";

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

    void this.runClaimedSession(claimed).finally(() => {
      this.activeSessions.delete(session.id);
    });

    return true;
  }

  private async runClaimedSession(session: SessionState): Promise<void> {
    const bot = await this.options.manager.connect();
    await this.options.manager.ensureCreativeMode();

    const tracker = new SessionTracker(session.id);
    const playerTracker = new PlayerTracker(bot);
    const escort = new EscortController(bot, {
      routeRadius: this.options.config.routeRadius,
    });
    const triggerMonitor = new TriggerMonitor();

    const ctx: TutorContext = {
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
      emitEvent: async (type: SessionEvent["type"], payload: Record<string, unknown>) => {
        await this.options.repository.appendEvent({
          type,
          sessionId: session.id,
          at: new Date().toISOString(),
          payload,
        });
      },
      persistState: async (updates: Partial<SessionState>, stateName?: TutorStateName) => {
        ctx.session = {
          ...ctx.session,
          ...updates,
          runtime: {
            ...ctx.session.runtime,
            ...(updates.runtime ?? {}),
            currentState: stateName ?? updates.runtime?.currentState ?? ctx.session.runtime?.currentState,
          },
        };
        await this.options.repository.save(ctx.session);
      },
      appendChatMessage: async (speaker, username, message) => {
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

        await this.options.repository.save(ctx.session);
        await ctx.emitEvent("chat", entry);
      },
    };

    const fsm = new TutorFSM(
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

    const onChat = (username: string, message: string) => {
      ctx.lastChatMessage = { username, message };
      void ctx.appendChatMessage("student", username, message);
      void fsm.handleChat(username, message);
    };

    this.options.manager.on("chat", onChat);

    const stopVoicePoll = this.startVoicePoll(session.id, ctx, fsm);

    try {
      log("session", `starting FSM for ${session.id}`);
      await fsm.start();
      while (!fsm.isCompleted()) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      log("session", `completed ${session.id}`);
    } finally {
      stopVoicePoll();
      this.options.manager.off("chat", onChat);
      await fsm.stop();
    }
  }

  private startVoicePoll(
    sessionId: string,
    ctx: TutorContext,
    fsm: TutorFSM,
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
        } catch {
          // File not present yet — normal
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
