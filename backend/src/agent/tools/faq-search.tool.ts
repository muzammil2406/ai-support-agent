import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Model } from 'mongoose';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { FaqEntry } from '../../mongo/schemas/faq-entry.schema';

interface FaqMatch {
  id: string;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * LangChain tool: semantic FAQ lookup.
 *
 * Pure MongoDB: entries store their 768-dim embedding as a plain array, and
 * the (small) FAQ set is scored with brute-force cosine similarity in memory.
 * Returns the top-5 best-matching Q&A entries.
 */
export function createFaqSearchTool(
  faqModel: Model<FaqEntry>,
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

      const filter = category
        ? { category, embedding: { $exists: true, $ne: null } }
        : { embedding: { $exists: true, $ne: null } };
      const entries = await faqModel.find(filter).lean().exec();

      const scored = entries
        .map((entry) => {
          const embedding = entry.embedding as number[] | undefined;
          return {
            entry,
            similarity: embedding
              ? cosineSimilarity(vector, embedding)
              : Number.NEGATIVE_INFINITY,
          };
        })
        .filter((s) => Number.isFinite(s.similarity));

      scored.sort((a, b) => b.similarity - a.similarity);

      const matches: FaqMatch[] = scored.slice(0, 5).map((s) => ({
        id: s.entry.id,
        question: s.entry.question,
        answer: s.entry.answer,
        category: s.entry.category,
        similarity: Number(s.similarity).toFixed(3),
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