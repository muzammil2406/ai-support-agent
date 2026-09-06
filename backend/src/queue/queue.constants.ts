export const POST_CONVERSATION_QUEUE = 'post-conversation-processing';

export const POST_CONVERSATION_QUEUE_TOKEN = 'Queue__post-conversation-processing';

/** Job name pushed to the post-conversation queue. */
export const POST_CONVERSATION_JOB = 'summarize-and-store';

/**
 * Attached into the job `data` so the worker knows which session it is
 * processing and (later) which ticket/reason triggered the terminal state.
 */
export interface PostConversationJobData {
  sessionId: string;
  userId: string;
  /** The terminal status that ended the conversation. */
  terminalStatus: 'resolved' | 'closed';
  /** Optional ticket id when the conversation was escalated then resolved. */
  ticketId?: string;
  /** Optional escalation reason captured at hand-off. */
  escalationReason?: string;
  endedAt: string;
}
