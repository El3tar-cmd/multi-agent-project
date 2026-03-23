import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { agentsTable } from "./agents";

export const tasksTable = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  model: text("model").default("glm-5:cloud"),
  ollamaEndpoint: text("ollama_endpoint").default("http://localhost:11434"),
  // Task chaining fields
  dependsOn: text("depends_on"),           // JSON array of task IDs this task depends on
  autoRun: integer("auto_run").default(0), // 1 = auto-trigger when dependencies complete
  orderIndex: integer("order_index").default(0), // Sequential order within project
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
