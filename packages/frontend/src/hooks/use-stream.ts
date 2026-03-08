import { useEffect, useRef, useState } from 'react';

import { appConfig } from '@/config';
import { normalizeStreamEvent } from '@/lib/types';
import { useQuizcraftStore } from '@/store';

const KNOWN_STREAM_EVENTS = [
  'status',
  'session_update',
  'build_progress',
  'state_changed',
  'chat',
  'summary_ready',
  'session_complete',
  'error',
  'heartbeat',
  'experience_ready',
  'build_plan_ready',
  'question_result',
];

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;
const RETRY_JITTER_FACTOR = 0.35;

const parsePayload = (rawPayload: string): unknown => {
  if (!rawPayload?.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawPayload);
  } catch {
    return { message: rawPayload };
  }
};

const getRetryDelayMs = (attempt: number) => {
  const baseDelay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt));
  const jitter = baseDelay * RETRY_JITTER_FACTOR * Math.random();
  return Math.round(baseDelay + jitter);
};

export const useStream = (sessionId: string | undefined) => {
  const addStreamEvent = useQuizcraftStore((store) => store.addStreamEvent);
  const setCurrentSessionId = useQuizcraftStore((store) => store.setCurrentSessionId);
  const setStreamStatus = useQuizcraftStore((store) => store.setStreamStatus);
  const streamStatus = useQuizcraftStore((store) => store.streamStatus);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    let isDisposed = false;
    let currentSource: EventSource | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSource = () => {
      if (currentSource) {
        currentSource.close();
        currentSource = null;
      }
    };

    if (!sessionId) {
      setCurrentSessionId(null);
      setStreamStatus('idle');
      setError(null);
      setLastEventAt(null);
      clearReconnectTimer();
      closeSource();
      return;
    }

    setCurrentSessionId(sessionId);
    setStreamStatus('connecting');
    setError(null);
    setLastEventAt(null);
    attemptRef.current = 0;

    const handleIncoming = (eventName: string, rawPayload: string) => {
      const parsed = parsePayload(rawPayload);
      const normalized = normalizeStreamEvent(eventName, parsed, sessionId);

      addStreamEvent(normalized);
      setLastEventAt(normalized.timestamp);
      setError(null);
    };

    const connect = () => {
      if (isDisposed) {
        return;
      }

      clearReconnectTimer();
      closeSource();
      setStreamStatus('connecting');

      const nextSource = new EventSource(appConfig.streamUrl(sessionId));
      currentSource = nextSource;

      nextSource.onopen = () => {
        attemptRef.current = 0;
        setStreamStatus('open');
        setError(null);
      };

      nextSource.onmessage = (event) => {
        handleIncoming('message', event.data);
      };

      for (const eventName of KNOWN_STREAM_EVENTS) {
        nextSource.addEventListener(eventName, (event) => {
          handleIncoming(eventName, (event as MessageEvent).data);
        });
      }

      nextSource.onerror = () => {
        if (isDisposed) {
          return;
        }

        clearReconnectTimer();
        closeSource();
        setStreamStatus('error');

        const delayMs = getRetryDelayMs(attemptRef.current);
        attemptRef.current += 1;
        setError(`Live session stream disconnected. Reconnecting in ${Math.ceil(delayMs / 1000)}s.`);

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      closeSource();
      setStreamStatus('closed');
    };
  }, [addStreamEvent, sessionId, setCurrentSessionId, setStreamStatus]);

  return {
    streamStatus,
    lastEventAt,
    error,
  };
};
