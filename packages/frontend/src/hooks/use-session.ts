import { useEffect, useState } from 'react';

import { fetchSession } from '@/lib/api';
import type { SessionRecord } from '@/lib/types';
import { useQuizcraftStore } from '@/store';

export const useSession = (sessionId: string | undefined) => {
  const storedSession = useQuizcraftStore((store) => store.session);
  const mergeSession = useQuizcraftStore((store) => store.mergeSession);
  const [isLoading, setIsLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const session = await fetchSession(sessionId);

        if (!cancelled) {
          mergeSession(session);
          setIsLoading(false);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load session');
          setIsLoading(false);
        }
      }
    };

    const shouldFetch = !storedSession || storedSession.id !== sessionId;
    if (shouldFetch) {
      void load();
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(false);
    return () => {
      cancelled = true;
    };
  }, [mergeSession, sessionId, storedSession]);

  const refresh = async () => {
    if (!sessionId) {
      return null;
    }

    const session = await fetchSession(sessionId);
    mergeSession(session);
    return session;
  };

  const session: SessionRecord | null =
    storedSession && (!sessionId || storedSession.id === sessionId) ? storedSession : null;

  return {
    session,
    isLoading,
    error,
    refresh,
  };
};
