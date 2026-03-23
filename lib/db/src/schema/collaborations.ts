import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { agentsTable } from "./agents";

export const collaborationsTable = sqliteTable("collaborations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  agents: text("agents").notNull(),          // JSON array of agent IDs
  pattern: text("pattern").notNull().default("round-robin"), // round-robin | lead-review | debate
  maxRounds: integer("max_rounds").notNull().default(3),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed
  model: text("model").default("glm-5:cloud"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const collaborationMessagesTable = sqliteTable("collaboration_messages", {
  id: text("id").primaryKey(),
  collaborationId: text("collaboration_id").notNull().references(() => collaborationsTable.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  agentName: text("agent_name"),
  role: text("role").notNull(), // system | assistant | user
  content: text("content").notNull(),
  round: integer("round").notNull().default(1),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertCollaborationSchema = createInsertSchema(collaborationsTable);
export type InsertCollaboration = z.infer<typeof insertCollaborationSchema>;
export type Collaboration = typeof collaborationsTable.$inferSelect;
export type CollaborationMessage = typeof collaborationMessagesTable.$inferSelect;
