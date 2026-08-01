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
import { createChatSocket } from '@/lib/socket';
import type { ChatSocket } from '@/lib/socket';
import type { ChatMessage } from '@/lib/types';

type DisplayMessage = ChatMessage & { streaming?: boolean };

interface SessionReadyPayload {
  sessionId: string;
  status: string;
  escalatedToHuman: boolean;
  ticketId?: string;
  messages?: ChatMessage[];
}

const TOOL_LABELS: Record<string, string> = {
  get_order_status: 'Checking order status',
  faq_lookup: 'Searching knowledge base',
  escalate_to_human: 'Requesting human agent',
};

export default function ChatWidget() {
  const router = useRouter();
  const user = getUser();

  const socketRef = useRef<ChatSocket | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      const text = payload.text;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          const next = [...prev];
          next[next.length - 1] = { ...last, content: last.content + text };
          return next;
        }
        return [...prev, { role: 'assistant', content: text, streaming: true }];
      });
    });

    socket.on(
      'agent.tool_call',
      (payload: { name: string; result?: unknown }) => {
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
      },
    );

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
            next[idx] = { ...finalMsg, toolCalls: next[idx].toolCalls ?? finalMsg.toolCalls };
          } else {
            next.push(finalMsg);
          }
          return next;
        });
        setStreaming(false);
      },
    );

    socket.on('agent.error', (payload: { message: string }) => {
      setError(payload.message);
      setStreaming(false);
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

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || !socketRef.current || !connected) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming(true);
    socketRef.current.emit('chat.send', { content: text });
  }

  function onEscalate() {
    const reason = window.prompt(
      'Tell the human agent what you need help with:',
      'I would like to talk to a human.',
    );
    if (reason === null) return;
    socketRef.current?.emit('escalate', { reason });
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

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              connected ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              Aurora — Stellar Goods Support
            </h1>
            <p className="text-xs text-slate-500">
              {connected
                ? escalated
                  ? 'A human agent is on the way'
                  : 'Online · AI agent'
                : 'Reconnecting…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:block">
            {user?.email}
          </span>
          {user?.role === 'support_agent' || user?.role === 'admin' ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Dashboard
            </button>
          ) : null}
          <button
            onClick={onSignOut}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Escalation banner */}
      {escalated && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          {ticketId ? (
            <>
              This chat has been escalated to a human agent
              (ticket #<span className="font-mono">{ticketId.slice(-6)}</span>).
            </>
          ) : (
            'This chat has been escalated to a human agent.'
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                Hi {user?.name?.split(' ')[0] || 'there'}! 👋
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ask me about your order, shipping, returns, billing or our products.
                Try: <span className="font-mono text-xs">Where is my order ORD-1002?</span>
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageRow key={`${msg.role}-${i}`} msg={msg} />
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <form onSubmit={onSend} className="mx-auto flex max-w-2xl items-end gap-2">
          <button
            type="button"
            onClick={onEscalate}
            disabled={escalated || streaming}
            className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            title="Ask for a human agent"
          >
            Escalate
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || cooldownSeconds > 0}
            placeholder={
              streaming
                ? 'Aurora is typing…'
                : cooldownSeconds > 0
                  ? `Rate limited — retry in ${cooldownSeconds}s`
                  : 'Type your question…'
            }
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={streaming || !connected || cooldownSeconds > 0 || !input.trim()}
            className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}

function MessageRow({ msg }: { msg: DisplayMessage }) {
  if (msg.role === 'escalation') {
    return (
      <div className="self-center rounded-full bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-br-sm bg-indigo-600 text-white'
            : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {(msg.toolCalls ?? []).map((tc, i) => (
          <div
            key={i}
            className="mb-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
            {TOOL_LABELS[tc.name] ?? tc.name}
          </div>
        ))}
        <p className="whitespace-pre-wrap">
          {msg.content}
          {msg.streaming ? (
            <span className="ml-0.5 inline-block animate-pulse text-indigo-400">▍</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
