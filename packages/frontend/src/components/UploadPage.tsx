import { startTransition, useState } from 'react';
import type { FormEvent } from 'react';
import { Compass, Flame, MapPinned, ScrollText, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useUpload } from '@/hooks/use-upload';
import type { UploadFormValues } from '@/lib/types';

const initialForm: UploadFormValues = {
  chapterText: '',
  gradeBand: 'middle_school',
  topic: '',
  questionCount: 4,
  objectiveEmphasis: 'artifact-hunt',
};

const emphasisOptions = [
  {
    value: 'artifact-hunt',
    label: 'Artifact hunt',
    description: 'End with a hidden item or keepsake that reinforces the lesson.',
  },
  {
    value: 'guided-tour',
    label: 'Guided tour',
    description: 'Lean into narration, landmarks, and location-based questioning.',
  },
  {
    value: 'evacuation-story',
    label: 'Story tension',
    description: 'Make the route feel urgent, dramatic, and mission-like.',
  },
];

export const UploadPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { upload, uploadError, clearUploadError } = useUpload();
  const [form, setForm] = useState<UploadFormValues>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showResetNotice = searchParams.get('reset') === '1';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.chapterText.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await upload(form);
      startTransition(() => {
        navigate(`/session/${response.sessionId}`);
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-ember/25 via-brass/10 to-transparent blur-3xl" />
            <div className="relative flex flex-col gap-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-basalt/70">
                  <Sparkles className="h-4 w-4 text-ember" />
                  QuizCraft Studio
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl font-display text-4xl leading-tight text-basalt sm:text-5xl lg:text-6xl">
                    Turn a history chapter into a five-minute Minecraft expedition.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-basalt/78 sm:text-lg">
                    Paste a chapter, pick the teaching angle, and QuizCraft will generate a
                    compact scene, a guided bot companion, and live status updates for the whole
                    session.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <article className="feature-card animate-riseIn [animation-delay:80ms]">
                  <ScrollText className="h-6 w-6 text-ember" />
                  <h2 className="text-lg font-semibold text-basalt">Chapter aware</h2>
                  <p className="text-sm leading-6 text-basalt/72">
                    Pulls key facts, landmarks, and questions straight from the pasted chapter.
                  </p>
                </article>
                <article className="feature-card animate-riseIn [animation-delay:160ms]">
                  <MapPinned className="h-6 w-6 text-brass" />
                  <h2 className="text-lg font-semibold text-basalt">Scene guided</h2>
                  <p className="text-sm leading-6 text-basalt/72">
                    Students move through a curated route instead of wandering an empty world.
                  </p>
                </article>
                <article className="feature-card animate-riseIn [animation-delay:240ms]">
                  <Compass className="h-6 w-6 text-sage" />
                  <h2 className="text-lg font-semibold text-basalt">Teacher visible</h2>
                  <p className="text-sm leading-6 text-basalt/72">
                    Watch planning, building, tutoring, and the recap from one browser window.
                  </p>
                </article>
              </div>

              <div className="rounded-[28px] border border-basalt/10 bg-basalt px-5 py-5 text-parchment shadow-ember sm:px-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-parchment/65">
                      Recommended classroom flow
                    </p>
                    <h2 className="mt-2 font-display text-2xl">Paste. Build. Join `localhost:25565`.</h2>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm text-parchment/82">
                    <Flame className="h-5 w-5 animate-pulseGlow text-ember" />
                    Middle-school sessions are tuned for 5 to 7 minutes.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="panel">
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="space-y-1">
                <p className="eyebrow">Teacher Setup</p>
                <h2 className="font-display text-3xl text-basalt">Launch a new experience</h2>
                <p className="text-sm leading-6 text-basalt/72">
                  Paste the chapter text below. The generated lesson will stay grounded in the
                  source chapter but can add symbolic Minecraft-friendly details.
                </p>
              </div>

              {showResetNotice ? (
                <div className="rounded-2xl border border-sage/25 bg-sage/10 px-4 py-3 text-sm text-basalt/78">
                  Minecraft reset complete. Upload a new chapter to start the next lesson.
                  <button
                    className="ml-3 font-semibold text-basalt underline decoration-basalt/30 underline-offset-4"
                    onClick={() => setSearchParams({}, { replace: true })}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}

              <label className="field-shell">
                <span className="field-label">Chapter text</span>
                <textarea
                  className="field-input min-h-64 resize-y"
                  placeholder="Paste the full history chapter or excerpt here..."
                  value={form.chapterText}
                  onChange={(event) => {
                    clearUploadError();
                    setForm((current) => ({ ...current, chapterText: event.target.value }));
                  }}
                />
                <span className="text-xs text-basalt/55">
                  One coherent chapter or excerpt works best for a compact session.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">Grade band</span>
                  <select
                    className="field-input"
                    value={form.gradeBand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, gradeBand: event.target.value }))
                    }
                  >
                    <option value="upper_elementary">Upper elementary</option>
                    <option value="middle_school">Middle school</option>
                    <option value="early_high_school">Early high school</option>
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">Topic label</span>
                  <input
                    className="field-input"
                    placeholder="Pompeii and Mount Vesuvius"
                    value={form.topic}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, topic: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="field-shell">
                <div className="flex items-center justify-between gap-3">
                  <span className="field-label">Question count</span>
                  <span className="rounded-full bg-basalt/7 px-3 py-1 text-xs font-semibold text-basalt/68">
                    {form.questionCount} prompts
                  </span>
                </div>
                <input
                  className="range-input"
                  max={5}
                  min={3}
                  step={1}
                  type="range"
                  value={form.questionCount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      questionCount: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <div className="space-y-3">
                <span className="field-label">Objective emphasis</span>
                <div className="grid gap-3">
                  {emphasisOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`choice-card ${
                        form.objectiveEmphasis === option.value ? 'choice-card-selected' : ''
                      }`}
                    >
                      <input
                        checked={form.objectiveEmphasis === option.value}
                        className="sr-only"
                        name="objectiveEmphasis"
                        type="radio"
                        value={option.value}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            objectiveEmphasis: event.target.value,
                          }))
                        }
                      />
                      <div>
                        <p className="text-sm font-semibold text-basalt">{option.label}</p>
                        <p className="mt-1 text-sm leading-6 text-basalt/66">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {uploadError ? (
                <div className="rounded-2xl border border-ember/20 bg-ember/8 px-4 py-3 text-sm text-ember">
                  {uploadError}
                </div>
              ) : null}

              <button
                className="cta-button"
                disabled={!form.chapterText.trim() || isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Preparing session...' : 'Generate Minecraft lesson'}
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
};
