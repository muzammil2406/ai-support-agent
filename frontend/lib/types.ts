export type MessageRole = 'user' | 'assistant' | 'system' | 'escalation';

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: string;
  toolCalls?: ToolCall[];
  escalationReason?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SessionInfo {
  sessionId: string;
  status: string;
  escalatedToHuman: boolean;
  ticketId?: string;
}

export interface DashboardSession {
  _id?: string;
  sessionId: string;
  userId: string;
  status: string;
  category?: string;
  escalatedToHuman: boolean;
  escalationReason?: string;
  ticketId?: string;
  startedAt?: string;
  updatedAt?: string;
  messages?: ChatMessage[];
}

export interface AnalyticsSummary {
  avgResolutionTimeByCategory: Array<{
    _id: string;
    avgResolutionMs: number;
    sessions: number;
  }>;
  topEscalationReasons: Array<{ _id: string; count: number }>;
  totals: Array<{
    totalSessions: number;
    escalated: number;
    resolved: number;
  }>;
}
