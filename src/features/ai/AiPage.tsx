import { ArrowUp, CloudOff, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConciergeResponse } from '@shared/types';
import { cn } from '../../lib/cn';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { LogoMark } from '../../components/ui/Logo';
import { ComparisonPanel } from './ComparisonPanel';
import { RecommendationRow } from './RecommendationRow';

const SUGGESTIONS = [
  'Find me something fun on Marietta Campus where I can meet other people who like gaming.',
  "I'm free after 5 and want something beginner-friendly.",
  'I want to try a new hobby but don’t know where to start.',
  'Anything outdoorsy this weekend?',
];

type Message = { role: 'user'; text: string } | { role: 'assistant'; response: ConciergeResponse } | { role: 'error'; text: string };

const TABS = [
  { id: 'concierge', label: 'Concierge' },
  { id: 'compare', label: 'Why AI?' },
] as const;

export function AiPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('concierge');
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-muted">Powered by Gemini, grounded in OwlMatch events</p>
      <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">Campus Concierge</h1>
      <div role="tablist" aria-label="AI views" className="mt-5 flex gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('h-10 flex-1 rounded-full text-sm font-semibold transition-colors', tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5">{tab === 'concierge' ? <Concierge /> : <ComparisonPanel />}</div>
    </div>
  );
}

function Concierge() {
  const { studentId } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const ask = async (text: string) => {
    const message = text.trim();
    if (message.length < 2 || pending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setPending(true);
    try {
      const response = await api.concierge(studentId, message);
      setMessages((m) => [...m, { role: 'assistant', response }]);
    } catch {
      setMessages((m) => [...m, { role: 'error', text: 'I could not reach OwlMatch just now. Please try again.' }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-4" aria-live="polite">
        <AssistantBubble>
          Hey! Tell me what you're in the mood for — a vibe, a time, a campus — and I'll find real activities on OwlMatch that fit.
        </AssistantBubble>

        {messages.length === 0 && (
          <div className="flex flex-col gap-2 pl-11">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm text-charcoal transition-colors hover:border-ink/30 hover:bg-surface">
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] animate-fade-up rounded-[1.5rem] rounded-br-md bg-ink px-4 py-3 text-[15px] text-white">{m.text}</p>
            </div>
          ) : m.role === 'error' ? (
            <AssistantBubble key={i}>{m.text}</AssistantBubble>
          ) : (
            <div key={i} className="animate-fade-up space-y-3">
              <AssistantBubble>
                {m.response.reply}
                {m.response.mode === 'fallback' && (
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <CloudOff size={12} aria-hidden /> Gemini unavailable — answered with OwlMatch's rule-based search
                  </span>
                )}
              </AssistantBubble>
              <div className="space-y-2.5 pl-11">
                {m.response.items.map((item) => (
                  <RecommendationRow key={item.event.id} item={item} />
                ))}
              </div>
            </div>
          ),
        )}

        {pending && (
          <AssistantBubble>
            <span className="flex items-center gap-2 text-muted" role="status">
              <Sparkles size={16} className="animate-pulse text-gold-deep" aria-hidden /> Searching campus activities…
            </span>
          </AssistantBubble>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-20 mt-6 flex items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-5 shadow-card md:bottom-4"
      >
        <label htmlFor="concierge-input" className="sr-only">
          Ask the concierge
        </label>
        <input
          id="concierge-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Find something fun this weekend…"
          maxLength={300}
          className="h-11 flex-1 bg-transparent text-[16px] placeholder:text-neutral focus:outline-none"
        />
        <button type="submit" disabled={pending || input.trim().length < 2} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-ink transition-transform active:scale-90 disabled:opacity-40">
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <LogoMark size={32} className="shrink-0" />
      <div className="max-w-[85%] rounded-[1.5rem] rounded-tl-md border border-line bg-white px-4 py-3 text-[15px] leading-relaxed text-charcoal">{children}</div>
    </div>
  );
}
