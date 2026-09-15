'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDashboardSessions,
  fetchTranscript,
  formatDuration,
} from '@/lib/api';
import { createChatSocket } from '@/lib/socket';
import type { ChatSocket } from '@/lib/socket';
import type { ChatMessage, DashboardSession } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  escalated: 'bg-amber-100 text-amber-800',
  resolved: 'bg-slate-100 text-slate-700',
  closed: 'bg-slate-100 text-slate-500',
};

export default function SessionsPanel() {
  const socketRef = useRef<ChatSocket | null>(null);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDashboardSessions();
      setSessions(data);
    } catch {
      /* keep last snapshot */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, 10_000);

    let active = true;
    let socket: ChatSocket | null = null;
    createChatSocket()
      .then((s) => {
        if (!active) { s.disconnect(); return; }
        socket = s;
        socketRef.current = s;
        s.on('connect', () => s.emit('chat.join', {}));
        s.on('session.open', refresh);
        s.on('session.escalated', refresh);
        s.on('session.updated', refresh);
      })
      .catch(() => {});

    return () => {
      active = false;
      window.clearInterval(poll);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [refresh]);

  async function toggleTranscript(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!transcripts[sessionId]) {
      try {
        const data = await fetchTranscript(sessionId);
        setTranscripts((prev) => ({ ...prev, [sessionId]: data.messages ?? [] }));
      } catch {
        setTranscripts((prev) => ({ ...prev, [sessionId]: [] }));
      }
    }
  }

  function resolve(sessionId: string) {
    socketRef.current?.emit('chat.resolve', { sessionId });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Live sessions
          <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {sessions.length}
          </span>
        </h2>
        <span className="text-xs text-slate-400">auto-refreshes every 10s</span>
      </header>

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          No active or escalated sessions right now.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sessions.map((s) => {
            const lastMessage = s.messages?.[s.messages.length - 1];
            return (
              <li key={s.sessionId}>
                <button
                  onClick={() => toggleTranscript(s.sessionId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_STYLES[s.status] ?? STATUS_STYLES.active
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="truncate font-mono text-xs text-slate-500">
                        {s.sessionId.slice(0, 8)}
                      </span>
                      <span className="text-xs font-medium text-slate-700">
                        {s.userId.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {s.escalationReason
                        ? `🚨 ${s.escalationReason}`
                        : lastMessage
                          ? String(lastMessage.content).slice(0, 80)
                          : 'No messages yet'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.status === 'escalated' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resolve(s.sessionId);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500"
                      >
                        Resolve
                      </button>
                    )}
                    <span className="text-xs text-slate-400">›</span>
                  </div>
                </button>

                {expanded === s.sessionId && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Transcript
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {(transcripts[s.sessionId] ?? []).map((m, i) => (
                        <li
                          key={i}
                          className={`max-w-[90%] rounded-lg px-3 py-1.5 text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'ml-auto bg-indigo-100 text-indigo-900'
                              : m.role === 'escalation'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-white text-slate-700 shadow-sm'
                          }`}
                        >
                          {String(m.content)}
                          {(m.toolCalls?.length ?? 0) > 0 && (
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              tools: {m.toolCalls?.map((t) => t.name).join(', ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
