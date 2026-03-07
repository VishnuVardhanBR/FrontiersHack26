import { useCallback, useRef, useState } from 'react';

import { appConfig } from '@/config';

type AnySpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => AnySpeechRecognition;
    webkitSpeechRecognition?: new () => AnySpeechRecognition;
  }
}

export const useVoiceInput = (sessionId: string) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'sending'>('idle');
  const recognitionRef = useRef<AnySpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const result = Array.from(event.results)
        .map((r) => Array.from(r)[0]?.transcript ?? '')
        .join('');
      setTranscript(result);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatus('idle');
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatus('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus('listening');
    setTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setStatus('idle');
  }, []);

  const submit = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      return;
    }

    setStatus('sending');
    try {
      await fetch(`${appConfig.apiBaseUrl}/api/sessions/${sessionId}/voice-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
    } finally {
      setTranscript('');
      setStatus('idle');
    }
  }, [transcript, sessionId]);

  return { isListening, transcript, status, startListening, stopListening, submit };
};
