import { CheckCircle2, Goal, Medal, MessageSquareQuote, Search } from 'lucide-react';

import type { SessionSummaryData } from '@/lib/types';

interface SessionSummaryProps {
  summary: SessionSummaryData;
}

const metricValue = (value: number | undefined, fallback = 'TBD') =>
  typeof value === 'number' ? String(value) : fallback;

export const SessionSummary = ({ summary }: SessionSummaryProps) => (
  <section className="panel-tight">
    <div className="flex items-center gap-2">
      <Medal className="h-5 w-5 text-brass" />
      <h2 className="font-display text-2xl text-basalt">Session summary</h2>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="summary-stat">
        <CheckCircle2 className="h-5 w-5 text-sage" />
        <div>
          <p className="stat-label">Score</p>
          <p className="stat-value">
            {typeof summary.scorePercent === 'number' ? `${summary.scorePercent}%` : 'TBD'}
          </p>
        </div>
      </div>
      <div className="summary-stat">
        <Goal className="h-5 w-5 text-ember" />
        <div>
          <p className="stat-label">Correct answers</p>
          <p className="stat-value">
            {metricValue(summary.correctAnswers)}/{metricValue(summary.totalQuestions)}
          </p>
        </div>
      </div>
      <div className="summary-stat">
        <Search className="h-5 w-5 text-brass" />
        <div>
          <p className="stat-label">Hints used</p>
          <p className="stat-value">{metricValue(summary.hintsUsed, '0')}</p>
        </div>
      </div>
      <div className="summary-stat">
        <MessageSquareQuote className="h-5 w-5 text-sage" />
        <div>
          <p className="stat-label">Attempts</p>
          <p className="stat-value">{metricValue(summary.totalAttempts, '0')}</p>
        </div>
      </div>
    </div>

    {summary.recap ? (
      <div className="mt-5 rounded-[24px] border border-basalt/8 bg-white/60 px-4 py-4 text-sm leading-7 text-basalt/78">
        {summary.recap}
      </div>
    ) : null}

    {summary.breakdown?.length ? (
      <div className="mt-5 space-y-3">
        <p className="eyebrow">Question Breakdown</p>
        <div className="grid gap-3">
          {summary.breakdown.map((question) => (
            <article key={question.id ?? question.prompt} className="rounded-2xl border border-basalt/8 bg-basalt/[0.03] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm font-semibold leading-6 text-basalt">{question.prompt}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    question.correct
                      ? 'bg-sage/12 text-sage'
                      : question.correct === false
                        ? 'bg-ember/12 text-ember'
                        : 'bg-basalt/8 text-basalt/60'
                  }`}
                >
                  {question.correct ? 'Secured' : question.correct === false ? 'Needs review' : 'In progress'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-basalt/56">
                <span className="rounded-full bg-white/70 px-2.5 py-1">Attempts: {metricValue(question.attempts, '0')}</span>
                <span className="rounded-full bg-white/70 px-2.5 py-1">Hints: {metricValue(question.hintsUsed, '0')}</span>
              </div>
              {question.feedback ? (
                <p className="mt-3 text-sm leading-6 text-basalt/72">{question.feedback}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    ) : null}
  </section>
);
