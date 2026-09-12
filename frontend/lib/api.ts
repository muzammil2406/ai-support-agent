import type {
  AnalyticsSummary,
  AuthResponse,
  ChatMessage,
  DashboardSession,
  User,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setAuth(accessToken: string, user: User): void {
  localStorage.setItem('token', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
  document.cookie = `auth_token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearAuth(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'auth_token=; path=/; max-age=0';
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export function login(email: string, password: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
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
