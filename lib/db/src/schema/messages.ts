import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = sqliteTable("messages", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  agentId: text("agent_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
