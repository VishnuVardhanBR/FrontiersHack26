import { BookOpenText, ChevronLeft, Pickaxe, ServerCrash } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ChatLog } from '@/components/ChatLog';
import { SessionStatus } from '@/components/SessionStatus';
import { SessionSummary } from '@/components/SessionSummary';
import { useSession } from '@/hooks/use-session';
import { useStream } from '@/hooks/use-stream';
import { humanize } from '@/lib/types';
import { useQuizcraftStore } from '@/store';

export const SessionPage = () => {
  const { id } = useParams<{ id: string }>();
  const { session, isLoading, error } = useSession(id);
  const { streamStatus, lastEventAt, error: streamError } = useStream(id);
  const streamEvents = useQuizcraftStore((store) => store.streamEvents);

  if (!id) {
    return (
      <main className="app-shell">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 text-center">
          <div className="panel max-w-xl">
            <ServerCrash className="mx-auto h-10 w-10 text-ember" />
            <h1 className="mt-4 font-display text-3xl text-basalt">Session id missing</h1>
            <p className="mt-3 text-sm leading-7 text-basalt/72">
              Return to the upload screen and create a new lesson.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
        <header className="panel flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-basalt/65 transition hover:text-basalt"
              to="/"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to upload
            </Link>
            <div>
              <p className="eyebrow">Session Monitor</p>
              <h1 className="font-display text-3xl text-basalt sm:text-4xl">
                {session?.experiencePackage?.title ?? 'Minecraft lesson in progress'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-basalt/72">
                Session id <code className="rounded bg-basalt/6 px-1.5 py-0.5 text-basalt">{id}</code>. Keep
                Minecraft pointed at <code className="rounded bg-basalt/6 px-1.5 py-0.5 text-basalt">localhost:25565</code>{' '}
                while the bot builds and runs the lesson.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-basalt/8 bg-white/60 px-4 py-3 text-sm text-basalt/72">
              <div className="inline-flex items-center gap-2 font-semibold text-basalt">
                <BookOpenText className="h-4 w-4 text-brass" />
                Status
              </div>
              <p className="mt-1">{humanize(session?.status, isLoading ? 'Loading session' : 'Waiting')}</p>
            </div>
            <div className="rounded-2xl border border-basalt/8 bg-white/60 px-4 py-3 text-sm text-basalt/72">
              <div className="inline-flex items-center gap-2 font-semibold text-basalt">
                <Pickaxe className="h-4 w-4 text-ember" />
                Stream
              </div>
              <p className="mt-1">{humanize(streamStatus)}</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-[28px] border border-ember/20 bg-ember/8 px-5 py-4 text-sm text-ember">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-4">
            {session ? (
              <SessionStatus
                lastEventAt={lastEventAt}
                session={session}
                streamError={streamError}
                streamStatus={streamStatus}
              />
            ) : (
              <div className="panel-tight space-y-4">
                <div className="skeleton-line h-5 w-32" />
                <div className="skeleton-line h-11 w-4/5" />
                <div className="skeleton-line h-24 w-full" />
                <div className="skeleton-line h-28 w-full" />
              </div>
            )}

            {session?.summary ? <SessionSummary summary={session.summary} /> : null}
          </div>

          <ChatLog session={session} streamEvents={streamEvents} />
        </section>
      </div>
    </main>
  );
};
