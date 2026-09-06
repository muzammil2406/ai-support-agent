import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';

export interface ConversationSummaryResult {
  summary: string;
  topics: string[];
  outcome: string;
}

const SUMMARY_PROMPT = `You are Nova's post-conversation analyst. A customer support conversation just ended.
Read the transcript (user / assistant / escalation messages) and produce:
1. A concise 2-4 sentence summary of what happened, what the customer needed, and how it was resolved.
2. A small comma-separated list of 2-5 topical tags (e.g. order, refund, shipping, account access).
3. A one-word outcome: escalated | resolved | closed.

Return ONLY valid JSON with this exact shape:
{"summary":"...","topics":["tag1","tag2"],"outcome":"resolved"}`;

/**
 * Summarizes a conversation with the same LLM provider/model family the live
 * agent uses (Groq or Gemini, controlled by LLM_PROVIDER / LLM_MODEL). Kept
 * self-contained inside the queue module so it can run as a standalone worker.
 */
@Injectable()
export class ConversationSummarizer {
  private readonly logger = new Logger(ConversationSummarizer.name);

  constructor(private readonly config: ConfigService) {}

  private buildChatModel() {
    const provider = this.config.get<string>('LLM_PROVIDER', 'groq');
    if (provider === 'google') {
      return new ChatGoogleGenerativeAI({
        apiKey: this.config.get('GOOGLE_API_KEY'),
        model: this.config.get<string>('LLM_MODEL', 'gemini-3.5-flash'),
        temperature: 0.2,
        maxOutputTokens: 1024,
      });
    }
    return new ChatGroq({
      apiKey: this.config.get('GROQ_API_KEY'),
      model: this.config.get<string>('LLM_MODEL', 'llama-3.3-70b-versatile'),
      temperature: 0.2,
    });
  }

  private buildTranscript(
    messages: Array<{ role: string; content: unknown }>,
  ): string {
    return messages
      .map((m) => {
        const role = m.role === 'escalation' ? 'escalation' : m.role;
        return `${role.toUpperCase()}: ${String(m.content ?? '')}`;
      })
      .join('\n');
  }

  /**
   * @param messages the full (or trailing) transcript for the ended session.
   */
  async summarize(
    messages: Array<{ role: string; content: unknown }>,
  ): Promise<ConversationSummaryResult> {
    const transcript = this.buildTranscript(messages);
    const model = this.buildChatModel();

    const resp = await model.invoke([
      ['system', SUMMARY_PROMPT],
      ['human', `CONVERSATION:\n${transcript}`],
    ]);

    const text = (resp.content ?? '')
      .toString()
      .trim()
      // Models occasionally wrap the JSON in code fences — strip them.
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    try {
      const parsed = JSON.parse(text) as {
        summary?: unknown;
        topics?: unknown;
        outcome?: unknown;
      };
      return {
        summary: String(parsed.summary ?? ''),
        topics: Array.isArray(parsed.topics)
          ? parsed.topics.map((t) => String(t).trim()).filter(Boolean)
          : [],
        outcome: String(parsed.outcome ?? 'resolved'),
      };
    } catch {
      this.logger.warn('Summarizer returned non-JSON, storing raw text');
      return {
        summary: text || 'No summary produced.',
        topics: [],
        outcome: 'resolved',
      };
    }
  }
}
