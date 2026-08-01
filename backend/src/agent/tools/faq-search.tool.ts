import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { PrismaService } from '../../prisma/prisma.service';

interface FaqMatch {
  id: string;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

/**
 * LangChain tool: semantic FAQ lookup.
 *
 * Memory constraint respected: only ONE embedding is produced per call (the
 * user's query) and we hit pgvector directly with a top-5 ANN query. The FAQ
 * set is never loaded into application memory.
 */
export function createFaqSearchTool(
  prisma: PrismaService,
  embeddings: EmbeddingsService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'faq_lookup',
    description:
      'Search the support knowledge base using semantic similarity and return the best-matching Q&A entries. Use for how-to and policy questions: shipping, returns, refunds, billing, account, warranty, product care. Returns up to 5 entries with question, answer, category and similarity score.',
    schema: z.object({
      query: z.string().describe('The customer question or topic to search for'),
      category: z
        .string()
        .optional()
        .describe(
          'Optional filter: shipping, returns, billing, orders, account, warranty, product',
        ),
    }),
    func: async ({ query, category }) => {
      const vector = await embeddings.embedQuery(query);
      const vectorLiteral = embeddings.toVectorString(vector);

      const rows = await prisma.$queryRaw<FaqMatch[]>`
        SELECT id, question, answer, category,
               1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM faq_entries
        WHERE embedding IS NOT NULL
          AND (${category ?? null}::text IS NULL OR category = ${category ?? null})
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT 5
      `;

      const matches = rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        category: r.category,
        similarity: Number(r.similarity).toFixed(3),
      }));

      return JSON.stringify(
        matches.length > 0
          ? { found: true, matches }
          : { found: false, message: 'No relevant FAQ entries found.' },
        null,
        2,
      );
    },
  });
}
