import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SessionsService } from '../../sessions/sessions.service';

/**
 * LangChain tool: human-escalation handoff.
 *
 * Binds to the current chat session so the handoff knows exactly which
 * transcript to escalate. Creates the Postgres Ticket and flips the Mongo
 * session to `escalated` (both driven by SessionsService).
 */
export function createEscalateToHumanTool(
  sessions: SessionsService,
  context: { sessionId?: string },
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'escalate_to_human',
    description:
      'Hand the current chat to a human support agent. Use when the customer explicitly asks for a human, is frustrated, or the issue needs human approval (refunds, exceptions, repeated failures the FAQ cannot fix).',
    schema: z.object({
      reason: z.string().describe('A concise reason for the escalation'),
    }),
    func: async ({ reason }) => {
      if (!context.sessionId) {
        return JSON.stringify({
          escalated: false,
          message: 'There is no active chat session to escalate.',
        });
      }

      const ticket = await sessions.escalate(context.sessionId, reason);
      return JSON.stringify(
        {
          escalated: true,
          ticketId: ticket.id,
          message:
            'A human support agent has been notified and will join this chat shortly.',
        },
        null,
        2,
      );
    },
  });
}
