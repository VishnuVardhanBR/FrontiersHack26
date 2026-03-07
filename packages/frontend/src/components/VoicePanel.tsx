import { Mic, MicOff, Send } from 'lucide-react';

import { useVoiceInput } from '@/hooks/use-voice-input';

interface VoicePanelProps {
  sessionId: string;
}

export const VoicePanel = ({ sessionId }: VoicePanelProps) => {
  const { isListening, transcript, status, startListening, stopListening, submit } =
    useVoiceInput(sessionId);

  const hasSpeechRecognition =
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!hasSpeechRecognition) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-basalt/8 bg-white/60 px-5 py-4">
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-basalt">Voice Input</p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
            isListening
              ? 'bg-ember text-white ring-4 ring-ember/25'
              : 'bg-basalt/8 text-basalt hover:bg-basalt/14',
          ].join(' ')}
          onClick={isListening ? stopListening : startListening}
          type="button"
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1 rounded-xl border border-basalt/10 bg-white px-3 py-2 text-sm text-basalt">
          {status === 'listening' && !transcript ? (
            <span className="animate-pulse text-basalt/40">Listening…</span>
          ) : status === 'sending' ? (
            <span className="text-basalt/40">Sending…</span>
          ) : transcript ? (
            transcript
          ) : (
            <span className="text-basalt/30">Press mic to speak an answer</span>
          )}
        </div>

        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/90 text-white transition hover:bg-brass disabled:opacity-40"
          disabled={!transcript.trim() || status === 'sending'}
          onClick={submit}
          type="button"
          aria-label="Send transcript"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
