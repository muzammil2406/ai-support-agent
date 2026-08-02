import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_DIMENSIONS = 768;

/**
 * Embedding provider (gemini-embedding-001, trimmed to 768 dims via
 * `outputDimensionality` — matching the pgvector column). Uses the raw
 * `@google/generative-ai` SDK because LangChain's embeddings wrapper does not
 * expose `outputDimensionality`, and `text-embedding-004` is no longer
 * available on new Google AI keys.
 *
 * Memory note: we always embed a single text at a time (never batch), so the
 * FAQ embedding set is never held in memory — every lookup queries pgvector
 * directly.
 */
@Injectable()
export class EmbeddingsService {
  private _client?: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {}

  private get client(): GoogleGenerativeAI {
    if (!this._client) {
      this._client = new GoogleGenerativeAI(
        this.config.getOrThrow<string>('GOOGLE_API_KEY'),
      );
    }
    return this._client;
  }

  /** Embed a single user query (dimension 768). */
  async embedQuery(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({
      model: this.config.get<string>('EMBEDDINGS_MODEL', 'gemini-embedding-001'),
    });
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as unknown as Parameters<typeof model.embedContent>[0]);
    return result.embedding.values;
  }

  /** Embed documents one at a time (used by the FAQ seeder — memory stays flat). */
  async embedTexts(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      out.push(await this.embedQuery(text));
    }
    return out;
  }

  /** Format a numeric vector as a Postgres vector literal, e.g. `[0.1,0.2,...]`. */
  toVectorString(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
