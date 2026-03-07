import { create } from 'zustand';

import {
  normalizeChatEntry,
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
  setSession: (session: SessionRecord | null) => void;
  mergeSession: (session: SessionRecord) => void;
  addStreamEvent: (event: StreamEnvelope) => void;
  setStreamStatus: (status: StreamStatus) => void;
  setUploadError: (error: string | null) => void;
  resetSession: () => void;
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

const integrateEvent = (session: SessionRecord | null, event: StreamEnvelope): SessionRecord | null => {
  const baseSession =
    session ??
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

  if (payload && typeof payload === 'object' && 'session' in payload) {
    const normalized = normalizeSession((payload as Record<string, unknown>).session);
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
        payload && typeof payload === 'object' && 'chat' in payload
          ? (payload as Record<string, unknown>).chat
          : payload ?? event.message,
        'bot',
      ),
    ]);
  }

  if (event.type === 'status') {
    const record = payload as Record<string, unknown> | undefined;
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;

    if (event.message) {
      nextSession.chatLog = mergeChatLog(nextSession.chatLog, [
        normalizeChatEntry(
          {
            id: event.id,
            speaker: 'system',
            message: event.message,
            timestamp: event.timestamp,
          },
          'system',
        ),
      ]);
    }
  }

  if (event.type === 'build_progress') {
    const record = payload as Record<string, unknown> | undefined;
    const progress = record?.progress ?? record?.percent ?? record?.buildProgress;
    if (typeof progress === 'number') {
      nextSession.buildProgress = progress;
    }
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;
  }

  if (event.type === 'state_changed') {
    const record = payload as Record<string, unknown> | undefined;
    nextSession.currentState =
      typeof record?.state === 'string'
        ? record.state
        : typeof record?.currentState === 'string'
          ? record.currentState
          : event.message ?? nextSession.currentState;
    nextSession.status = typeof record?.status === 'string' ? record.status : nextSession.status;
  }

  if (event.type === 'summary_ready' || event.type === 'session_complete') {
    nextSession.summary = normalizeSummary(
      payload && typeof payload === 'object' && 'summary' in payload
        ? (payload as Record<string, unknown>).summary
        : payload,
    );
    nextSession.status = 'completed';
  }

  if (event.type === 'error') {
    nextSession.error =
      typeof event.message === 'string'
        ? event.message
        : payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).error === 'string'
          ? String((payload as Record<string, unknown>).error)
          : 'Session error';
    nextSession.status = 'error';
  }

  return nextSession;
};

export const useQuizcraftStore = create<QuizcraftStore>((set) => ({
  currentSessionId: null,
  session: null,
  streamEvents: [],
  streamStatus: 'idle',
  uploadError: null,
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setSession: (session) => set({ session }),
  mergeSession: (incomingSession) =>
    set((state) => ({
      session:
        state.session && state.session.id === incomingSession.id
          ? {
              ...state.session,
              ...incomingSession,
              chatLog: mergeChatLog(state.session.chatLog, incomingSession.chatLog),
            }
          : incomingSession,
      currentSessionId: incomingSession.id,
    })),
  addStreamEvent: (event) =>
    set((state) => ({
      streamEvents: [...state.streamEvents.slice(-149), event],
      session: integrateEvent(state.session, event),
    })),
  setStreamStatus: (streamStatus) => set({ streamStatus }),
  setUploadError: (uploadError) => set({ uploadError }),
  resetSession: () =>
    set({
      currentSessionId: null,
      session: null,
      streamEvents: [],
      streamStatus: 'idle',
      uploadError: null,
    }),
}));
