import type {
  AnalyticsSummary,
  AuthResponse,
  ChatMessage,
  DashboardSession,
  User,
} from './types';

const PROXY_BASE = '/api/proxy';

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PROXY_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      const err = (Array.isArray(body?.message) ? body.message[0] : body?.message) as string | undefined;
      if (err) message = err;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Auth (backend-driven, HttpOnly cookie) ──────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new Error(msg ?? 'Login failed.');
  }
  return data;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new Error(msg ?? 'Registration failed.');
  }
  return data;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function me(): Promise<User | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.user ?? null;
}

/** Ephemeral JWT for the WebSocket handshake only (never persisted). */
export async function getWsToken(): Promise<string | null> {
  const res = await fetch('/api/auth/ws-token');
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.token ?? null;
}

// ── Sessions ────────────────────────────────────────────────────────────────
export async function fetchDashboardSessions(): Promise<DashboardSession[]> {
  return api<DashboardSession[]>('/sessions');
}

export async function fetchTranscript(
  sessionId: string,
): Promise<{ sessionId: string; messages: ChatMessage[] }> {
  return api<{ sessionId: string; messages: ChatMessage[] }>(
    `/sessions/${sessionId}`,
  );
}

// ── Analytics ───────────────────────────────────────────────────────────────
export function fetchAnalytics(): Promise<AnalyticsSummary> {
  return api<AnalyticsSummary>('/analytics/summary');
}

// ── Formatting helpers ──────────────────────────────────────────────────────
export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} hr`;
}