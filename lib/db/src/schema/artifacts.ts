import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { tasksTable } from "./tasks";

export const artifactsTable = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull().default("text/plain"),
  content: text("content").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  language: text("language"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertArtifactSchema = createInsertSchema(artifactsTable);
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type Artifact = typeof artifactsTable.$inferSelect;
