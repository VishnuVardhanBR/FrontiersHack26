import { create } from 'zustand';

import {
  normalizeChatEntry,
  normalizeExperiencePackage,
  normalizeSession,
  normalizeSummary,
  type SessionRecord,
  type StreamEnvelope,
} from '@/lib/types';

type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface QuizcraftStore {
  currentSessionId: string | null;
  session: SessionRecord | null;
  streamEvents: StreamEnvelope[];
  streamStatus: StreamStatus;
  uploadError: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  mergeSession: (session: SessionRecord) => void;
  addStreamEvent: (event: StreamEnvelope) => void;
  setStreamStatus: (status: StreamStatus) => void;
  setUploadError: (error: string | null) => void;
}

const mergeChatLog = (existing: SessionRecord['chatLog'], incoming: SessionRecord['chatLog']) => {
  const merged = [...existing];
  const knownIds = new Set(existing.map((entry) => entry.id));

  for (const entry of incoming) {
    if (!knownIds.has(entry.id)) {
      merged.push(entry);
      knownIds.add(entry.id);
    }
  }

  return merged.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
};

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const appendSystemMessage = (
  session: SessionRecord,
  event: StreamEnvelope,
  fallbackMessage?: string,
): SessionRecord => {
  const message =
    typeof event.message === 'string' && event.message.trim() ? event.message : fallbackMessage?.trim();

  if (!message) {
    return session;
  }

  return {
    ...session,
    chatLog: mergeChatLog(session.chatLog, [
      normalizeChatEntry(
        {
          id: `system-${event.id}`,
          speaker: 'system',
          message,
          timestamp: event.timestamp,
        },
        'system',
      ),
    ]),
  };
};

const integrateEvent = (session: SessionRecord | null, event: StreamEnvelope): SessionRecord | null => {
  if (session && event.sessionId && session.id !== event.sessionId) {
    return session;
  }

  const baseSession =
    (session && (!event.sessionId || session.id === event.sessionId) ? session : null) ??
    (event.sessionId
      ? {
          id: event.sessionId,
          status: 'pending',
          chatLog: [],
        }
      : null);

  if (!baseSession) {
    return null;
  }

  const payload = event.payload;
  const nextSession = { ...baseSession };
  const payloadRecord = asRecord(payload);

  if (payloadRecord && 'session' in payloadRecord) {
    const normalized = normalizeSession(payloadRecord.session);
    nextSession.status = normalized.status;
    nextSession.currentState = normalized.currentState;
    nextSession.buildProgress = normalized.buildProgress;
    nextSession.error = normalized.error;
    nextSession.experiencePackage = normalized.experiencePackage ?? nextSession.experiencePackage;
    nextSession.summary = normalized.summary ?? nextSession.summary;
    nextSession.chatLog = mergeChatLog(nextSession.chatLog, normalized.chatLog);
  }

  if (event.type === 'session_update' && payloadRecord) {
    const normalized = normalizeSession(payloadRecord);
    nextSession.status = normalized.status;
    nextSession.currentState = normalized.currentState;
    nextSession.buildProgress = normalized.buildProgress;
    nextSession.error = normalized.error;
    nextSession.experiencePackage = normalized.experiencePackage ?? nextSession.experiencePackage;
    nextSession.summary = normalized.summary ?? nextSession.summary;
    nextSession.chatLog = mergeChatLog(nextSession.chatLog, normalized.chatLog);
  }

  if (event.type === 'chat') {
    nextSession.chatLog = mergeChatLog(nextSession.chatLog, [
      normalizeChatEntry(
        payloadRecord && 'chat' in payloadRecord
          ? payloadRecord.chat
          : payload ?? event.message,
        'bot',
      ),
    ]);
  }

  if (event.type === 'status') {
    const record = payloadRecord;
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;
    return appendSystemMessage(nextSession, event, typeof record?.message === 'string' ? record.message : undefined);
  }

  if (event.type === 'build_progress') {
    const record = payloadRecord;
    const progress = record?.progress ?? record?.percent ?? record?.buildProgress;
    if (typeof progress === 'number') {
      nextSession.buildProgress = progress;
    }
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;
    const currentStep = typeof record?.currentStep === 'string' ? record.currentStep : undefined;
    const progressMessage =
      typeof progress === 'number'
        ? `Scene build ${Math.round(progress)}% complete${currentStep ? `: ${currentStep}` : ''}.`
        : currentStep;
    return appendSystemMessage(nextSession, event, progressMessage);
  }

  if (event.type === 'state_changed') {
    const record = payloadRecord;
    nextSession.currentState =
      typeof record?.state === 'string'
        ? record.state
        : typeof record?.currentState === 'string'
          ? record.currentState
          : event.message ?? nextSession.currentState;
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;
    return appendSystemMessage(nextSession, event, undefined);
  }

  if (event.type === 'experience_ready') {
    const experiencePackage =
      payloadRecord && 'experiencePackage' in payloadRecord
        ? normalizeExperiencePackage(payloadRecord.experiencePackage)
        : normalizeExperiencePackage(payload);
    if (experiencePackage) {
      nextSession.experiencePackage = experiencePackage;
    }
    return appendSystemMessage(nextSession, event, 'Experience package ready.');
  }

  if (event.type === 'summary_ready' || event.type === 'session_complete') {
    nextSession.summary = normalizeSummary(
      payloadRecord && 'summary' in payloadRecord
        ? payloadRecord.summary
        : payload,
    );
    nextSession.status = 'completed';
    return appendSystemMessage(nextSession, event, 'Session complete. Summary is ready.');
  }

  if (event.type === 'question_result') {
    const feedback = typeof payloadRecord?.feedback === 'string' ? payloadRecord.feedback : undefined;
    return appendSystemMessage(nextSession, event, feedback);
  }

  if (event.type === 'build_plan_ready') {
    return appendSystemMessage(nextSession, event, 'Build plan is ready.');
  }

  if (event.type === 'error') {
    nextSession.error =
      typeof event.message === 'string'
        ? event.message
        : payloadRecord && typeof payloadRecord.error === 'string'
          ? String(payloadRecord.error)
          : 'Session error';
    nextSession.status = 'error';
    return appendSystemMessage(nextSession, event, nextSession.error);
  }

  return nextSession;
};

export const useQuizcraftStore = create<QuizcraftStore>((set) => ({
  currentSessionId: null,
  session: null,
  streamEvents: [],
  streamStatus: 'idle',
  uploadError: null,
  setCurrentSessionId: (currentSessionId) =>
    set((state) => {
      if (state.currentSessionId === currentSessionId) {
        return state;
      }

      return {
        currentSessionId,
        session:
          currentSessionId && state.session && state.session.id === currentSessionId
            ? state.session
            : null,
        streamEvents: [],
        streamStatus: 'idle',
      };
    }),
  mergeSession: (incomingSession) =>
    set((state) => {
      if (state.currentSessionId && incomingSession.id !== state.currentSessionId) {
        return state;
      }

      return {
        session:
          state.session && state.session.id === incomingSession.id
            ? {
                ...state.session,
                ...incomingSession,
                chatLog: mergeChatLog(state.session.chatLog, incomingSession.chatLog),
              }
            : incomingSession,
        currentSessionId: incomingSession.id,
      };
    }),
  addStreamEvent: (incomingEvent) =>
    set((state) => {
      const eventSessionId = incomingEvent.sessionId ?? state.currentSessionId ?? state.session?.id;
      if (!eventSessionId) {
        return state;
      }

      if (state.currentSessionId && eventSessionId !== state.currentSessionId) {
        return state;
      }

      const event =
        incomingEvent.sessionId === eventSessionId
          ? incomingEvent
          : {
              ...incomingEvent,
              sessionId: eventSessionId,
            };

      if (state.streamEvents.some((existing) => existing.id === event.id)) {
        return state;
      }

      return {
        currentSessionId: eventSessionId,
        streamEvents: [...state.streamEvents.slice(-149), event],
        session: integrateEvent(state.session, event),
      };
    }),
  setStreamStatus: (streamStatus) => set({ streamStatus }),
  setUploadError: (uploadError) => set({ uploadError }),
}));
