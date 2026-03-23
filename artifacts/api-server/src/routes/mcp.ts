import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mcpServersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler, Errors } from "../lib/error-handler.js";
import { mcpManager } from "../lib/mcp/mcp-manager.js";

const router: IRouter = Router();

/**
 * List all registered MCP servers
 */
router.get("/mcp/servers", asyncHandler(async (_req, res) => {
  const servers = db.select().from(mcpServersTable).all();

  // Enrich with connection status
  const enriched = servers.map((s) => {
    const conn = mcpManager.getConnection(s.id);
    return {
      ...s,
      args: s.args ? JSON.parse(s.args) : [],
      envVars: s.envVars ? JSON.parse(s.envVars) : {},
      toolsCache: s.toolsCache ? JSON.parse(s.toolsCache) : [],
      connectionStatus: conn?.status || "disconnected",
      toolCount: conn?.tools.length || 0,
    };
  });

  res.json({ servers: enriched, total: enriched.length });
}));

/**
 * Register a new MCP server
 */
router.post("/mcp/servers", asyncHandler(async (req, res) => {
  const { name, description, transportType, command, args, url, envVars, category } = req.body as {
    name: string;
    description?: string;
    transportType?: string;
    command?: string;
    args?: string[];
    url?: string;
    envVars?: Record<string, string>;
    category?: string;
  };

  if (!name) throw Errors.validation("name is required");
  if (transportType === "stdio" && !command) {
    throw Errors.validation("command is required for stdio transport");
  }
  if ((transportType === "http" || transportType === "sse") && !url) {
    throw Errors.validation("url is required for HTTP/SSE transport");
  }

  const server = {
    id: randomUUID(),
    name,
    description: description || null,
    transportType: transportType || "stdio",
    command: command || null,
    args: args ? JSON.stringify(args) : null,
    url: url || null,
    envVars: envVars ? JSON.stringify(envVars) : null,
    category: category || null,
    isActive: 1,
    toolsCache: null,
    lastConnected: null,
    createdAt: new Date().toISOString(),
  };

  db.insert(mcpServersTable).values(server).run();
  res.status(201).json(server);
}));

/**
 * Get details for a specific MCP server
 */
router.get("/mcp/servers/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const server = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();

  if (!server) throw Errors.notFound("MCP Server", id);

  const conn = mcpManager.getConnection(id);
  res.json({
    ...server,
    args: server.args ? JSON.parse(server.args) : [],
    envVars: server.envVars ? JSON.parse(server.envVars) : {},
    toolsCache: server.toolsCache ? JSON.parse(server.toolsCache) : [],
    connectionStatus: conn?.status || "disconnected",
    tools: conn?.tools || [],
  });
}));

/**
 * Delete an MCP server
 */
router.delete("/mcp/servers/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const server = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();

  if (!server) throw Errors.notFound("MCP Server", id);

  mcpManager.disconnect(id);
  db.delete(mcpServersTable).where(eq(mcpServersTable.id, id)).run();
  res.json({ success: true, message: "MCP server removed" });
}));

/**
 * Toggle MCP server active status
 */
router.patch("/mcp/servers/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const server = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();

  if (!server) throw Errors.notFound("MCP Server", id);

  const { isActive, name, description, category } = req.body as {
    isActive?: number;
    name?: string;
    description?: string;
    category?: string;
  };

  const updates: Record<string, unknown> = {};
  if (isActive !== undefined) updates.isActive = isActive;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;

  db.update(mcpServersTable).set(updates).where(eq(mcpServersTable.id, id)).run();

  if (isActive === 0) mcpManager.disconnect(id);

  const updated = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();
  res.json(updated);
}));

/**
 * Connect to MCP server and discover tools
 */
router.post("/mcp/servers/:id/connect", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const server = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();

  if (!server) throw Errors.notFound("MCP Server", id);

  const connection = await mcpManager.connect(id);
  res.json({
    serverId: id,
    status: connection.status,
    tools: connection.tools,
    toolCount: connection.tools.length,
    error: connection.lastError || null,
  });
}));

/**
 * List tools from a connected MCP server
 */
router.get("/mcp/servers/:id/tools", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const conn = mcpManager.getConnection(id);

  if (conn && conn.status === "connected") {
    res.json({ tools: conn.tools, total: conn.tools.length });
    return;
  }

  // Try to get cached tools from DB
  const server = db.select().from(mcpServersTable)
    .where(eq(mcpServersTable.id, id))
    .get();

  if (!server) throw Errors.notFound("MCP Server", id);

  const cachedTools = server.toolsCache ? JSON.parse(server.toolsCache) : [];
  res.json({
    tools: cachedTools,
    total: cachedTools.length,
    cached: true,
    message: conn ? `Server status: ${conn.status}` : "Server not connected",
  });
}));

/**
 * Execute a tool on a connected MCP server
 */
router.post("/mcp/tools/execute", asyncHandler(async (req, res) => {
  const { serverId, toolName, arguments: toolArgs } = req.body as {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };

  if (!serverId || !toolName) {
    throw Errors.validation("serverId and toolName are required");
  }

  const result = await mcpManager.executeTool(serverId, toolName, toolArgs || {});
  res.json({ result });
}));

/**
 * List all tools across all connected MCP servers
 */
router.get("/mcp/tools", asyncHandler(async (_req, res) => {
  const tools = mcpManager.getAllTools();
  res.json({ tools, total: tools.length });
}));

export default router;
