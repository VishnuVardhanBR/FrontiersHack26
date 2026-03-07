import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Compass, Construction, RadioTower, Sparkles, TimerReset } from 'lucide-react';

import { humanize, type SessionRecord } from '@/lib/types';

const ANIMATION_DURATION_MS = 1500;

interface SessionStatusProps {
  lastEventAt: string | null;
  session: SessionRecord;
  streamError: string | null;
  streamStatus: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
}

export const SessionStatus = ({
  lastEventAt,
  session,
  streamError,
  streamStatus,
}: SessionStatusProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationStarted = useRef<string | null>(null);

  // Animate progress bar from 0 to 100 over 1.5s when we have a session (scene is built in backend)
  useEffect(() => {
    if (!session?.id) return;
    if (animationStarted.current === session.id) return;
    animationStarted.current = session.id;
    setDisplayProgress(0);
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(100, (elapsed / ANIMATION_DURATION_MS) * 100);
      setDisplayProgress(p);
      if (p < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [session?.id]);

  const progress = Math.round(displayProgress);
  const isReady = progress >= 100 || session.status === 'waiting_for_player';
  const experience = session.experiencePackage;
  const regions = experience?.sceneSpec?.regions ?? [];
  const questionCount = experience?.questionPlan?.length ?? session.summary?.totalQuestions ?? 0;

  return (
    <div className="space-y-4">
      <section className="panel-tight">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Live Status</p>
            <h2 className="font-display text-2xl text-basalt">{humanize(session.currentState, 'Booting session')}</h2>
          </div>
          <div
            className={`status-pill ${
              streamStatus === 'open'
                ? 'status-pill-open'
                : streamStatus === 'error'
                  ? 'status-pill-error'
                  : 'status-pill-muted'
            }`}
          >
            <RadioTower className="h-4 w-4" />
            {humanize(streamStatus)}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm text-basalt/72">
            <span className="inline-flex items-center gap-2">
              <Construction className="h-4 w-4 text-ember" />
              Scene build progress
            </span>
            <strong className="text-basalt">{progress}%</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill transition-all duration-150 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          {isReady ? (
            <div className="rounded-2xl border border-sage/40 bg-sage/15 px-4 py-4 text-center">
              <p className="text-lg font-semibold text-sage">Ready</p>
              <p className="mt-1 text-sm text-basalt/80">
                You can join the Minecraft server at <code className="rounded bg-basalt/10 px-1.5 py-0.5">localhost:25565</code> now.
              </p>
            </div>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-3 text-sm text-basalt/74 sm:grid-cols-2">
          <div className="rounded-2xl bg-basalt/4 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-basalt/50">Session status</dt>
            <dd className="mt-1 font-semibold text-basalt">{humanize(session.status)}</dd>
          </div>
          <div className="rounded-2xl bg-basalt/4 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-basalt/50">Last event</dt>
            <dd className="mt-1 font-semibold text-basalt">
              {lastEventAt ? new Date(lastEventAt).toLocaleTimeString() : 'Waiting for stream'}
            </dd>
          </div>
        </dl>

        {streamError ? (
          <div className="mt-4 rounded-2xl border border-ember/20 bg-ember/8 px-4 py-3 text-sm text-ember">
            {streamError}
          </div>
        ) : null}
      </section>

      <section className="panel-tight">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brass" />
          <h3 className="font-display text-2xl text-basalt">
            {experience?.title ?? 'Experience package pending'}
          </h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-basalt/72">
          {experience?.historicalSummary ??
            'The planner is still turning the uploaded chapter into a scene brief, route, and question set.'}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="stat-card">
            <Compass className="h-4 w-4 text-sage" />
            <div>
              <p className="stat-label">Regions</p>
              <p className="stat-value">{regions.length || 'TBD'}</p>
            </div>
          </div>
          <div className="stat-card">
            <CheckCircle2 className="h-4 w-4 text-ember" />
            <div>
              <p className="stat-label">Questions</p>
              <p className="stat-value">{questionCount || 'TBD'}</p>
            </div>
          </div>
          <div className="stat-card">
            <TimerReset className="h-4 w-4 text-brass" />
            <div>
              <p className="stat-label">Target length</p>
              <p className="stat-value">
                {experience?.durationMinutes ? `${experience.durationMinutes} min` : '5-7 min'}
              </p>
            </div>
          </div>
        </div>

        {experience?.learningObjectives?.length ? (
          <div className="mt-5 space-y-3">
            <p className="eyebrow">Learning Objectives</p>
            <ul className="grid gap-2">
              {experience.learningObjectives.map((objective) => (
                <li key={objective.id ?? objective.text} className="list-row">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sage" />
                  <span>{objective.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {regions.length ? (
          <div className="mt-5 space-y-3">
            <p className="eyebrow">Route Preview</p>
            <div className="grid gap-3">
              {regions.map((region) => (
                <div key={region.id} className="rounded-2xl border border-basalt/8 bg-white/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-basalt">{humanize(region.id)}</p>
                    <span className="rounded-full bg-brass/12 px-2.5 py-1 text-xs font-semibold text-brass">
                      {humanize(region.purpose, 'Scene beat')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-basalt/68">{region.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
