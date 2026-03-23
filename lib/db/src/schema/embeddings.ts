import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const embeddingsTable = sqliteTable("embeddings", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),  // "task_result" | "message" | "artifact" | "context" | "manual"
  sourceId: text("source_id"),                // ID of the source record
  content: text("content").notNull(),         // Original text
  contentHash: text("content_hash").notNull(), // SHA-256 hash for dedup
  embedding: text("embedding").notNull(),      // JSON array of floats
  dimensions: integer("dimensions").notNull(), // embedding vector size
  model: text("model").notNull().default("nomic-embed-text"), // embedding model used
  metadata: text("metadata"),                 // JSON extra metadata
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertEmbeddingSchema = createInsertSchema(embeddingsTable);
export type InsertEmbedding = z.infer<typeof insertEmbeddingSchema>;
export type Embedding = typeof embeddingsTable.$inferSelect;
