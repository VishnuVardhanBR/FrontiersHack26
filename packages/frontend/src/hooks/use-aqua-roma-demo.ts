import { useState } from 'react';
import { startAquaRomaDemo } from '@/lib/api';
import { useQuizcraftStore } from '@/store';

export const useAquaRomaDemo = () => {
  const setCurrentSessionId = useQuizcraftStore((store) => store.setCurrentSessionId);
  const mergeSession = useQuizcraftStore((store) => store.mergeSession);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDemo = async () => {
    setError(null);
    setIsStarting(true);
    try {
      const response = await startAquaRomaDemo();
      setCurrentSessionId(response.sessionId);
      if (response.session) {
        mergeSession(response.session);
      }
      return response;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start Aqua Roma demo';
      setError(message);
      throw e;
    } finally {
      setIsStarting(false);
    }
  };

  return {
    startDemo,
    isStarting,
    error,
    clearError: () => setError(null),
  };
};
