import { db } from "@workspace/db";
import { mcpServersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpConnection {
  serverId: string;
  serverName: string;
  tools: McpTool[];
  status: "connected" | "disconnected" | "error";
  lastError?: string;
}

/**
 * MCP Manager — manages connections to external MCP servers.
 * 
 * Architecture:
 * - Stores MCP server configs in SQLite (mcp_servers table)
 * - Connects to servers via stdio, SSE, or HTTP transports
 * - Discovers tools from each server
 * - Provides a unified interface for tool execution
 * 
 * Note: Full MCP SDK integration (Client class) will be connected
 * when @modelcontextprotocol/sdk is installed. For now, this provides
 * the management layer and HTTP-based tool proxying.
 */
class McpManager {
  private connections = new Map<string, McpConnection>();

  /**
   * Get all registered MCP servers from the database
   */
  getRegisteredServers() {
    return db.select().from(mcpServersTable).all();
  }

  /**
   * Get active servers only
   */
  getActiveServers() {
    return db.select().from(mcpServersTable)
      .where(eq(mcpServersTable.isActive, 1))
      .all();
  }

  /**
   * Get a specific server by ID
   */
  getServer(id: string) {
    return db.select().from(mcpServersTable)
      .where(eq(mcpServersTable.id, id))
      .get();
  }

  /**
   * Connect to an MCP server and discover its tools.
   * For now uses HTTP-based tool discovery for remote servers
   * and subprocess communication for stdio servers.
   */
  async connect(serverId: string): Promise<McpConnection> {
    const server = this.getServer(serverId);
    if (!server) throw new Error(`MCP server not found: ${serverId}`);

    const connection: McpConnection = {
      serverId: server.id,
      serverName: server.name,
      tools: [],
      status: "disconnected",
    };

    try {
      if (server.transportType === "http" || server.transportType === "sse") {
        // HTTP/SSE transport: call tools/list endpoint
        const baseUrl = server.url;
        if (!baseUrl) throw new Error("URL required for HTTP/SSE transport");

        const response = await fetch(`${baseUrl}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json() as { result?: { tools?: McpTool[] } };
          connection.tools = data.result?.tools || [];
          connection.status = "connected";
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } else if (server.transportType === "stdio") {
        // Stdio transport: will use @modelcontextprotocol/sdk Client
        // For now, mark as connected with cached tools
        const cachedTools = server.toolsCache ? JSON.parse(server.toolsCache) : [];
        connection.tools = cachedTools;
        connection.status = "connected";
        logger.info({ serverId, name: server.name }, "Stdio MCP server registered (SDK integration pending)");
      }

      // Update tools cache and last connected timestamp
      db.update(mcpServersTable)
        .set({
          toolsCache: JSON.stringify(connection.tools),
          lastConnected: new Date().toISOString(),
        })
        .where(eq(mcpServersTable.id, serverId))
        .run();

      this.connections.set(serverId, connection);
      logger.info({ serverId, toolCount: connection.tools.length }, "MCP server connected");

    } catch (err: any) {
      connection.status = "error";
      connection.lastError = err.message;
      this.connections.set(serverId, connection);
      logger.error({ serverId, err: err.message }, "Failed to connect MCP server");
    }

    return connection;
  }

  /**
   * Disconnect from an MCP server
   */
  disconnect(serverId: string) {
    this.connections.delete(serverId);
  }

  /**
   * Get connection status
   */
  getConnection(serverId: string): McpConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Get all available tools across all connected servers
   */
  getAllTools(): Array<McpTool & { serverId: string; serverName: string }> {
    const allTools: Array<McpTool & { serverId: string; serverName: string }> = [];

    for (const [_, conn] of this.connections) {
      if (conn.status === "connected") {
        for (const tool of conn.tools) {
          allTools.push({
            ...tool,
            serverId: conn.serverId,
            serverName: conn.serverName,
          });
        }
      }
    }

    return allTools;
  }

  /**
   * Execute a tool on a specific MCP server.
   * For HTTP servers, sends a JSON-RPC call.
   * For stdio servers, delegates to MCP SDK (when installed).
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const server = this.getServer(serverId);
    if (!server) throw new Error(`MCP server not found: ${serverId}`);

    if (server.transportType === "http" || server.transportType === "sse") {
      const baseUrl = server.url;
      if (!baseUrl) throw new Error("URL required for HTTP/SSE transport");

      const response = await fetch(`${baseUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: toolName, arguments: args },
          id: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Tool execution failed: HTTP ${response.status}`);
      }

      const data = await response.json() as { result?: unknown; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      return data.result;
    }

    // Stdio transport: placeholder for SDK integration
    throw new Error("Stdio tool execution requires @modelcontextprotocol/sdk — install it to enable this feature");
  }

  /**
   * Connect to all active servers on startup
   */
  async connectAll() {
    const activeServers = this.getActiveServers();
    const results = await Promise.allSettled(
      activeServers.map((s) => this.connect(s.id)),
    );

    const connected = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    logger.info({ connected, failed, total: activeServers.length }, "MCP servers initialization complete");
  }
}

// Singleton
export const mcpManager = new McpManager();
