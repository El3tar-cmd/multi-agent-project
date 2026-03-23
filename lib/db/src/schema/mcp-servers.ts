import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mcpServersTable = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  transportType: text("transport_type").notNull().default("stdio"), // stdio | sse | http
  command: text("command"),        // for stdio: e.g. "npx", "node", "python"
  args: text("args"),              // JSON array of command args
  url: text("url"),                // for sse/http transport
  envVars: text("env_vars"),       // JSON object of env vars to pass
  category: text("category"),      // e.g. "file-system", "code-execution", "search"
  isActive: integer("is_active").notNull().default(1),
  toolsCache: text("tools_cache"), // JSON cache of discovered tools
  lastConnected: text("last_connected"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertMcpServerSchema = createInsertSchema(mcpServersTable);
export type InsertMcpServer = z.infer<typeof insertMcpServerSchema>;
export type McpServer = typeof mcpServersTable.$inferSelect;
