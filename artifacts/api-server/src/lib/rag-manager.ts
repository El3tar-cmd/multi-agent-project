import { db } from "@workspace/db";
import { embeddingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { logger } from "./logger.js";

const DEFAULT_ENDPOINT = "http://localhost:11434";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";

/**
 * RAG Manager — handles embedding generation, storage, and semantic search.
 * 
 * Uses Ollama's embedding API to generate vectors, stores them in SQLite,
 * and performs cosine similarity search for semantic retrieval.
 */
class RagManager {
  private endpoint: string;
  private model: string;

  constructor() {
    this.endpoint = process.env.OLLAMA_ENDPOINT || DEFAULT_ENDPOINT;
    this.model = process.env.EMBED_MODEL || DEFAULT_EMBED_MODEL;
  }

  /**
   * Generate embedding vector from text using Ollama
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embed API error: ${response.status}`);
      }

      const data = await response.json() as { embeddings: number[][] };
      return data.embeddings[0];
    } catch (err: any) {
      logger.error({ err: err.message }, "Failed to generate embedding");
      throw err;
    }
  }

  /**
   * Index content — generate embedding and store it
   */
  async indexContent(opts: {
    projectId: string;
    content: string;
    sourceType: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const contentHash = createHash("sha256").update(opts.content).digest("hex");

    // Check for duplicate
    const existing = db.select().from(embeddingsTable)
      .where(and(
        eq(embeddingsTable.projectId, opts.projectId),
        eq(embeddingsTable.contentHash, contentHash),
      ))
      .get();

    if (existing) {
      logger.info({ id: existing.id }, "Content already indexed, skipping");
      return existing.id;
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(opts.content);

    const record = {
      id: randomUUID(),
      projectId: opts.projectId,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId || null,
      content: opts.content,
      contentHash,
      embedding: JSON.stringify(embedding),
      dimensions: embedding.length,
      model: this.model,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      createdAt: new Date().toISOString(),
    };

    db.insert(embeddingsTable).values(record).run();
    logger.info({ id: record.id, sourceType: opts.sourceType, dims: embedding.length }, "Content indexed");
    return record.id;
  }

  /**
   * Semantic search — find most similar content in a project
   */
  async search(projectId: string, query: string, topK: number = 5): Promise<Array<{
    id: string;
    content: string;
    sourceType: string;
    sourceId: string | null;
    similarity: number;
    metadata: Record<string, unknown> | null;
  }>> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Get all embeddings for this project
    const records = db.select().from(embeddingsTable)
      .where(eq(embeddingsTable.projectId, projectId))
      .all();

    if (records.length === 0) return [];

    // Calculate cosine similarity
    const results = records.map((record) => {
      const storedEmbedding: number[] = JSON.parse(record.embedding);
      const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
      return {
        id: record.id,
        content: record.content,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        similarity,
        metadata: record.metadata ? JSON.parse(record.metadata) : null,
      };
    });

    // Sort by similarity (descending) and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Index all existing content in a project (batch indexing)
   */
  async indexProject(projectId: string): Promise<{ indexed: number; skipped: number; errors: number }> {
    const { tasksTable, messagesTable, contextTable, artifactsTable } = await import("@workspace/db");
    let indexed = 0, skipped = 0, errors = 0;

    // Index task results
    const tasks = db.select().from(tasksTable)
      .where(eq(tasksTable.projectId, projectId)).all();

    for (const task of tasks) {
      if (!task.result) continue;
      try {
        await this.indexContent({
          projectId,
          content: `Task: ${task.title}\n\n${task.result}`,
          sourceType: "task_result",
          sourceId: task.id,
          metadata: { title: task.title, agentId: task.agentId },
        });
        indexed++;
      } catch { skipped++; }
    }

    // Index context items
    const contextItems = db.select().from(contextTable)
      .where(eq(contextTable.projectId, projectId)).all();

    for (const ctx of contextItems) {
      try {
        await this.indexContent({
          projectId,
          content: `${ctx.key}: ${ctx.value}`,
          sourceType: "context",
          sourceId: ctx.id,
          metadata: { key: ctx.key, source: ctx.source },
        });
        indexed++;
      } catch { skipped++; }
    }

    // Index artifacts
    const artifacts = db.select().from(artifactsTable)
      .where(eq(artifactsTable.projectId, projectId)).all();

    for (const art of artifacts) {
      try {
        await this.indexContent({
          projectId,
          content: `File: ${art.filename}\n\n${art.content.substring(0, 8000)}`,
          sourceType: "artifact",
          sourceId: art.id,
          metadata: { filename: art.filename, language: art.language },
        });
        indexed++;
      } catch { errors++; }
    }

    logger.info({ projectId, indexed, skipped, errors }, "Project indexing complete");
    return { indexed, skipped, errors };
  }

  /**
   * Delete all embeddings for a project
   */
  clearProject(projectId: string) {
    db.delete(embeddingsTable)
      .where(eq(embeddingsTable.projectId, projectId))
      .run();
  }

  /**
   * Get indexing stats for a project
   */
  getStats(projectId: string) {
    const records = db.select().from(embeddingsTable)
      .where(eq(embeddingsTable.projectId, projectId)).all();

    const byType: Record<string, number> = {};
    for (const r of records) {
      byType[r.sourceType] = (byType[r.sourceType] || 0) + 1;
    }

    return {
      totalEmbeddings: records.length,
      byType,
      model: this.model,
      dimensions: records[0]?.dimensions || 0,
    };
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Singleton
export const ragManager = new RagManager();
