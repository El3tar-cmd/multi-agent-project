import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contextTable = sqliteTable("context", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertContextSchema = createInsertSchema(contextTable).omit({ createdAt: true });
export type InsertContext = z.infer<typeof insertContextSchema>;
export type Context = typeof contextTable.$inferSelect;
