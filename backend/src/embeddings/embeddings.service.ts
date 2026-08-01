import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

/**
 * Embedding provider (Gemini text-embedding-004 → 768 dims, matching the
 * pgvector column). The client is created lazily so the app can boot without
 * the API key present.
 *
 * Memory note: `maxBatchSize: 1` keeps embeddings to a single text at a time —
 * we never hold the FAQ embedding set in memory. Every lookup queries pgvector
 * directly.
 */
@Injectable()
export class EmbeddingsService {
  private _embeddings?: GoogleGenerativeAIEmbeddings;

  constructor(private readonly config: ConfigService) {}

  private get embeddings(): GoogleGenerativeAIEmbeddings {
    if (!this._embeddings) {
      this._embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: this.config.getOrThrow<string>('GOOGLE_API_KEY'),
        model: this.config.get<string>('EMBEDDINGS_MODEL', 'text-embedding-004'),
        maxConcurrency: 1,
      });
      // One embedding per request — never batch, keep memory flat.
      this._embeddings.maxBatchSize = 1;
    }
    return this._embeddings;
  }

  /** Embed a single user query (dimension 768). */
  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  /** Embed a single document (used by the FAQ seeder, one at a time). */
  async embedTexts(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }

  /** Format a numeric vector as a Postgres vector literal, e.g. `[0.1,0.2,...]`. */
  toVectorString(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
