import { useEffect, useState } from 'react';

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
];

export const useStream = (sessionId: string | undefined) => {
  const addStreamEvent = useQuizcraftStore((store) => store.addStreamEvent);
  const setStreamStatus = useQuizcraftStore((store) => store.setStreamStatus);
  const streamStatus = useQuizcraftStore((store) => store.streamStatus);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStreamStatus('idle');
      return;
    }

    setStreamStatus('connecting');
    setError(null);

    const eventSource = new EventSource(appConfig.streamUrl(sessionId));

    const handleIncoming = (eventName: string, rawPayload: string) => {
      try {
        const parsed = rawPayload ? JSON.parse(rawPayload) : {};
        const normalized = normalizeStreamEvent(eventName, parsed);
        addStreamEvent(normalized);
        setLastEventAt(normalized.timestamp);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to parse stream event');
      }
    };

    eventSource.onopen = () => {
      setStreamStatus('open');
    };

    eventSource.onmessage = (event) => {
      handleIncoming('message', event.data);
    };

    for (const eventName of KNOWN_STREAM_EVENTS) {
      eventSource.addEventListener(eventName, (event) => {
        handleIncoming(eventName, (event as MessageEvent).data);
      });
    }

    eventSource.onerror = () => {
      setStreamStatus('error');
      setError('Live session stream disconnected.');
      eventSource.close();
    };

    return () => {
      setStreamStatus('closed');
      eventSource.close();
    };
  }, [addStreamEvent, sessionId, setStreamStatus]);

  return {
    streamStatus,
    lastEventAt,
    error,
  };
};
