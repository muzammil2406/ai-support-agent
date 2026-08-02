'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getUser } from '@/lib/api';
import NovaMark from '@/components/brand/NovaMark';
import { createChatSocket } from '@/lib/socket';
import type { ChatSocket } from '@/lib/socket';
import type { ChatMessage, ToolCall } from '@/lib/types';

type DisplayMessage = ChatMessage & { streaming?: boolean };

interface SessionReadyPayload {
  sessionId: string;
  status: string;
  escalatedToHuman: boolean;
  ticketId?: string;
  messages?: ChatMessage[];
}

interface ToolStartPayload {
  name: string;
  args?: Record<string, unknown>;
}

const TOOL_LABELS: Record<string, string> = {
  get_order_status: 'Checking your order',
  faq_lookup: 'Searching the knowledge base',
  escalate_to_human: 'Contacting a human agent',
};

const SUGGESTIONS = [
  {
    label: 'Where is my order ORD-1002?',
    question: 'Where is my order ORD-1002?',
    icon: '📦',
  },
  {
    label: 'What is your return policy?',
    question: 'What is your return policy?',
    icon: '↩️',
  },
  {
    label: 'How long does shipping take?',
    question: 'How long does standard shipping take?',
    icon: '🚚',
  },
  {
    label: 'Talk to a human agent',
    question: 'I want to talk to a human agent now.',
    icon: '🙋',
  },
];

export default function ChatWidget() {
  const router = useRouter();
  const user = getUser();

  const socketRef = useRef<ChatSocket | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [pendingTools, setPendingTools] = useState<ToolStartPayload[]>([]);
  const [escalated, setEscalated] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escReason, setEscReason] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingTools, waiting, scrollToBottom]);

  // Countdown for rate-limit cooldown.
  useEffect(() => {
    if (!cooldownUntil) return;
    const t = window.setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
        window.clearInterval(t);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  const handleSessionReady = useCallback((payload: SessionReadyPayload) => {
    setSessionId(payload.sessionId);
    localStorage.setItem('sessionId', payload.sessionId);
    setEscalated(payload.escalatedToHuman);
    setTicketId(payload.ticketId ?? null);
    setMessages((payload.messages ?? []).map((m) => ({ ...m, streaming: false })));
  }, []);

  useEffect(() => {
    const socket = createChatSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const resume = localStorage.getItem('sessionId');
      socket.emit('chat.join', resume ? { sessionId: resume } : {});
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('session.ready', handleSessionReady);

    socket.on('agent.token', (payload: { text: string }) => {
      setWaiting(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          const next = [...prev];
          next[next.length - 1] = { ...last, content: last.content + payload.text };
          return next;
        }
        return [...prev, { role: 'assistant', content: payload.text, streaming: true }];
      });
    });

    socket.on('agent.tool_start', (payload: ToolStartPayload) => {
      setWaiting(false);
      setPendingTools((prev) =>
        prev.some((t) => t.name === payload.name) ? prev : [...prev, payload],
      );
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') return prev;
        return [...prev, { role: 'assistant', content: '', streaming: true }];
      });
    });

    socket.on('agent.tool_call', (payload: { name: string; result?: unknown }) => {
      setPendingTools((prev) => prev.filter((t) => t.name !== payload.name));
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            toolCalls: [
              ...(last.toolCalls ?? []),
              { name: payload.name, result: payload.result },
            ],
          };
        }
        return next;
      });
    });

    socket.on(
      'agent.message',
      (payload: { content: string; toolCalls?: ChatMessage['toolCalls'] }) => {
        setMessages((prev) => {
          const next = [...prev];
          let idx = -1;
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'assistant') {
              idx = i;
              break;
            }
          }
          const finalMsg: DisplayMessage = {
            role: 'assistant',
            content: payload.content,
            toolCalls: payload.toolCalls,
          };
          if (idx >= 0) {
            next[idx] = {
              ...finalMsg,
              toolCalls: next[idx].toolCalls ?? finalMsg.toolCalls,
            };
          } else {
            next.push(finalMsg);
          }
          return next;
        });
        setStreaming(false);
        setWaiting(false);
        setPendingTools([]);
      },
    );

    socket.on('agent.error', (payload: { message: string }) => {
      setError(payload.message);
      setStreaming(false);
      setWaiting(false);
      setPendingTools([]);
    });

    socket.on(
      'escalated',
      (payload: { sessionId: string; ticketId: string; reason: string }) => {
        setEscalated(true);
        setTicketId(payload.ticketId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'escalation',
            content: `A human support agent has been notified (ticket #${payload.ticketId.slice(-6)}). They will join this chat shortly.`,
          },
        ]);
      },
    );

    socket.on('rate_limited', (payload: { retryAfterMs: number }) => {
      setCooldownUntil(Date.now() + payload.retryAfterMs);
      setError('You are sending messages too quickly. Please slow down.');
    });

    socket.on('session.resolved', () => {
      setError(null);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [handleSessionReady]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !socketRef.current || !connected) return;
      if (cooldownUntil && Date.now() < cooldownUntil) return;
      setInput('');
      setError(null);
      setShowEscalate(false);
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setStreaming(true);
      setWaiting(true);
      setPendingTools([]);
      socketRef.current.emit('chat.send', { content: trimmed });
    },
    [streaming, connected, cooldownUntil],
  );

  function onSend(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onSubmitEscalation(e: FormEvent) {
    e.preventDefault();
    const reason = escReason.trim() || 'Customer requested a human agent.';
    socketRef.current?.emit('escalate', { reason });
    setShowEscalate(false);
    setEscReason('');
  }

  function onSignOut() {
    clearAuth();
    localStorage.removeItem('sessionId');
    router.replace('/login');
    router.refresh();
  }

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    : 0;
  const firstTurn = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 px-4 py-3 shadow-lg shadow-indigo-900/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <NovaMark className="h-10 w-10 rounded-full shadow-lg shadow-indigo-900/20 ring-2 ring-white/30" />
            <div>
              <h1 className="text-sm font-bold text-white">Nova</h1>
              <p className="text-xs text-indigo-100">
                {escalated
                  ? 'A human agent is on the way'
                  : connected
                    ? 'Stellar Goods support · AI assistant'
                    : 'Reconnecting…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                connected
                  ? 'bg-emerald-400/20 text-emerald-50'
                  : 'bg-amber-400/20 text-amber-50'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-emerald-300' : 'bg-amber-300 animate-pulse'
                }`}
              />
              {connected ? 'Online' : 'Reconnecting'}
            </span>
            <span className="hidden max-w-[140px] truncate text-xs text-indigo-100 sm:block">
              {user?.email}
            </span>
            {user?.role === 'support_agent' || user?.role === 'admin' ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
              >
                Dashboard
              </button>
            ) : null}
            <button
              onClick={onSignOut}
              title="Sign out"
              className="rounded-full p-1.5 text-indigo-100 transition hover:bg-white/15 hover:text-white"
            >
              <SignOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Escalation banner */}
      {escalated && (
        <div className="relative z-10 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          {ticketId ? (
            <>
              Escalated to a human agent — ticket{' '}
              <span className="rounded bg-amber-200 px-1.5 py-0.5 font-mono">
                #{ticketId.slice(-6)}
              </span>
            </>
          ) : (
            'This chat has been escalated to a human agent.'
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50/60 via-slate-100 to-slate-100">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {firstTurn && (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5">
              <div className="flex items-start gap-3">
                <NovaMark className="h-11 w-11 shrink-0 rounded-2xl shadow-lg shadow-indigo-500/30" />
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    Hi {user?.name?.split(' ')[0] || 'there'} 👋
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    I'm Nova, the Stellar Goods assistant. Ask me about your
                    order, shipping, returns, billing or products — or tap a
                    suggestion to get started.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.question}
                    onClick={() => sendMessage(s.question)}
                    disabled={streaming}
                    className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    <span className="text-base leading-none">{s.icon}</span>
                    <span className="flex-1">{s.label}</span>
                    <ArrowIcon className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageRow key={`${msg.role}-${i}`} msg={msg} />
          ))}

          {/* Live indicator for the current turn */}
          {streaming && (
            <div className="flex justify-start">
              <Avatar />
              <div className="ml-2 flex items-center gap-2">
                {pendingTools.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm"
                  >
                    <LoaderIcon className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                    {t.name === 'get_order_status' && !t.args?.orderNumber
                      ? 'Looking up your orders'
                      : (TOOL_LABELS[t.name] ?? t.name)}
                    {t.name === 'get_order_status' &&
                      typeof t.args?.orderNumber === 'string' && (
                        <span className="font-mono text-indigo-400">
                          {String(t.args.orderNumber)}
                        </span>
                      )}
                  </span>
                ))}
                {!pendingTools.length && waiting && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                    <Dot className="h-2 w-2 animate-bounce bg-indigo-400" />
                    <Dot className="h-2 w-2 animate-bounce bg-indigo-400 [animation-delay:120ms]" />
                    <Dot className="h-2 w-2 animate-bounce bg-indigo-400 [animation-delay:240ms]" />
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="self-center rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {showEscalate && !escalated && (
            <form
              onSubmit={onSubmitEscalation}
              className="mb-2 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">
                  🙋 Request a human agent
                </span>
                <button
                  type="button"
                  onClick={() => setShowEscalate(false)}
                  className="rounded-full p-1 text-amber-500 transition hover:bg-amber-100"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={escReason}
                onChange={(e) => setEscReason(e.target.value)}
                placeholder="Briefly describe what you need help with (optional)…"
                rows={2}
                className="w-full resize-none rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
              />
              <button
                type="submit"
                className="self-end rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
              >
                Notify a human agent
              </button>
            </form>
          )}

          <form
            onSubmit={onSend}
            className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-lg shadow-slate-900/5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
          >
            <button
              type="button"
              onClick={() => {
                if (escalated) return;
                setShowEscalate((v) => !v);
              }}
              disabled={escalated || streaming}
              title="Request a human agent"
              className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                escalated
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
              } disabled:opacity-50`}
            >
              <HeadsetIcon className="h-5 w-5" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming || cooldownSeconds > 0}
              placeholder={
                streaming
                  ? 'Nova is responding…'
                  : cooldownSeconds > 0
                    ? `Rate limited — retry in ${cooldownSeconds}s`
                    : 'Message Nova…'
              }
              className="h-9 flex-1 bg-transparent px-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !connected || cooldownSeconds > 0 || !input.trim()}
              title="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-violet-600 active:scale-95 disabled:opacity-40 disabled:shadow-none"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-1.5 px-1 text-center text-[11px] text-slate-400">
            Nova is an AI assistant — verify critical details with our support
            team.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Message rendering ──────────────────────────────────────────────────────

function Avatar() {
  return <NovaMark className="h-8 w-8 rounded-full shadow-md shadow-indigo-500/25" />;
}

function MessageRow({ msg }: { msg: DisplayMessage }) {
  if (msg.role === 'escalation') {
    return (
      <div className="self-center rounded-full bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 ring-1 ring-amber-200">
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  const tools = (msg.toolCalls ?? []) as ToolCall[];

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar />}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-600/25'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {tools.map((tc, i) => (
          <div
            key={i}
            className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-600"
          >
            <CheckIcon className="h-3 w-3" />
            {TOOL_LABELS[tc.name] ?? tc.name}
          </div>
        ))}
        <p className="whitespace-pre-wrap">
          {msg.content}
          {msg.streaming ? (
            <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm bg-indigo-400 align-middle" />
          ) : null}
        </p>
      </div>
    </div>
  );
}

// ── Icons (inline, no extra deps) ──────────────────────────────────────────

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm18 0h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-5Z" />
      <path d="M4 11V9a8 8 0 0 1 16 0v2" />
      <path d="M20 16v1a3 3 0 0 1-3 3h-4" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function Dot({ className }: { className?: string }) {
  return <span className={`rounded-full ${className}`} />;
}
