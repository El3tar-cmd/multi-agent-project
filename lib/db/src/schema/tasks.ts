import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  agentId: text("agent_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  model: text("model").default("glm-5:cloud"),
  ollamaEndpoint: text("ollama_endpoint").default("http://localhost:11434"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
