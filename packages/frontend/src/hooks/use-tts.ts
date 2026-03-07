import { useCallback, useEffect, useRef } from 'react';

import { appConfig } from '@/config';
import type { StreamEnvelope } from '@/lib/types';

export const useTTS = (streamEvents: StreamEnvelope[], voiceEnabled: boolean) => {
  const lastIndexRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // Pre-warm the AudioContext on the first user interaction so the browser
  // autoplay policy doesn't block TTS that arrives later.
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [getAudioContext]);

  const playAudio = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !text.trim()) {
        return;
      }

      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/api/voice/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          console.warn('[tts] server error', response.status, await response.text());
          return;
        }

        const { audio } = (await response.json()) as { audio: string; mimeType: string };

        const audioContext = getAudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const rawBytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
        const int16 = new Int16Array(rawBytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = (int16[i] ?? 0) / 32768;
        }

        const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
        audioBuffer.copyToChannel(float32, 0);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      } catch (err) {
        console.warn('[tts] playback error', err);
      }
    },
    [voiceEnabled, getAudioContext],
  );

  useEffect(() => {
    const newEvents = streamEvents.slice(lastIndexRef.current);
    lastIndexRef.current = streamEvents.length;

    for (const event of newEvents) {
      if (event.type === 'chat') {
        const payload = event.payload as Record<string, unknown> | undefined;
        if (payload?.speaker === 'bot' && typeof payload?.message === 'string') {
          void playAudio(payload.message);
        }
      }
    }
  }, [streamEvents, playAudio]);
};
