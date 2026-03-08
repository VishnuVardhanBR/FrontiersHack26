import { useDeferredValue, useEffect, useRef } from 'react';
import { Bot, FlaskConical, UserRound } from 'lucide-react';

import type { ChatEntry, SessionRecord } from '@/lib/types';

interface ChatLogProps {
  session: SessionRecord | null;
}

interface FeedItem extends ChatEntry {
  kind: 'chat' | 'system';
}

export const ChatLog = ({ session }: ChatLogProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const feed = (session?.chatLog ?? [])
    .map((entry) => ({
      ...entry,
      kind: entry.speaker === 'system' ? ('system' as const) : ('chat' as const),
    }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const deferredFeed = useDeferredValue(feed);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: deferredFeed.length > 1 ? 'smooth' : 'auto',
    });
  }, [deferredFeed.length]);

  return (
    <section className="panel flex h-full min-h-[540px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-basalt/8 pb-4">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h2 className="font-display text-2xl text-basalt">Tutor conversation</h2>
        </div>
        <div className="rounded-full bg-basalt/6 px-3 py-1 text-xs font-semibold text-basalt/65">
          {deferredFeed.length} entries
        </div>
      </div>

      <div ref={containerRef} className="feed-fade mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
        {deferredFeed.length ? (
          deferredFeed.map((item) => (
            <article
              key={item.id}
              className={`message-shell ${
                item.kind === 'system'
                  ? 'message-shell-system'
                  : item.speaker === 'student'
                    ? 'message-shell-student'
                    : item.speaker === 'teacher'
                      ? 'message-shell-teacher'
                      : 'message-shell-bot'
              }`}
            >
              <div className="mt-1 rounded-2xl bg-white/80 p-2 text-basalt/80">
                {item.kind === 'system' ? (
                  <FlaskConical className="h-4 w-4" />
                ) : item.speaker === 'student' ? (
                  <UserRound className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-basalt/48">
                  <span>{item.kind === 'system' ? 'System' : item.speaker}</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-basalt/82">{item.message}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-basalt/12 bg-white/45 px-8 text-center text-sm leading-7 text-basalt/58">
            Once the bot starts narrating and the session state changes, this feed will populate in
            real time.
          </div>
        )}
      </div>
    </section>
  );
};
