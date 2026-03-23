import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, agentsTable, artifactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/error-handler.js";

const router: IRouter = Router();

/**
 * MCP-compatible JSON-RPC endpoint.
 * Exposes the platform's own capabilities as an MCP server,
 * allowing other MCP clients to discover and invoke platform tools.
 */
router.post("/mcp/rpc", asyncHandler(async (req, res) => {
  const { jsonrpc, method, params, id } = req.body as {
    jsonrpc: string;
    method: string;
    params?: Record<string, unknown>;
    id: number | string;
  };

  if (jsonrpc !== "2.0") {
    res.json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" }, id });
    return;
  }

  try {
    const result = await handleRpcMethod(method, params || {});
    res.json({ jsonrpc: "2.0", result, id });
  } catch (err: any) {
    res.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: err.message },
      id,
    });
  }
}));

/**
 * SSE endpoint for MCP server protocol
 */
router.get("/mcp/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send server info
  res.write(`data: ${JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {
      serverInfo: {
        name: "multi-agent-platform",
        version: "1.0.0",
      },
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
    },
  })}\n\n`);

  req.on("close", () => { /* client disconnected */ });
});

async function handleRpcMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
        },
        serverInfo: {
          name: "multi-agent-platform",
          version: "1.0.0",
        },
      };

    case "tools/list":
      return {
        tools: [
          {
            name: "list_projects",
            description: "List all projects on the multi-agent platform",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "list_agents",
            description: "List all available AI agents with their specializations",
            inputSchema: {
              type: "object",
              properties: {
                category: { type: "string", description: "Filter by category" },
              },
            },
          },
          {
            name: "create_project",
            description: "Create a new project on the platform",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Project name" },
                description: { type: "string", description: "Project description" },
              },
              required: ["name"],
            },
          },
          {
            name: "get_project_artifacts",
            description: "List all artifacts/files for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "Project ID" },
              },
              required: ["projectId"],
            },
          },
          {
            name: "search_project_memory",
            description: "Semantic search across project memory using RAG",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "Project ID" },
                query: { type: "string", description: "Search query" },
                topK: { type: "number", description: "Number of results (default 5)" },
              },
              required: ["projectId", "query"],
            },
          },
          {
            name: "get_project_summary",
            description: "Get a full project summary with tasks, status, and context",
            inputSchema: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "Project ID" },
              },
              required: ["projectId"],
            },
          },
        ],
      };

    case "tools/call": {
      const toolName = params.name as string;
      const args = (params.arguments || {}) as Record<string, unknown>;
      return await executeTool(toolName, args);
    }

    case "resources/list":
      return {
        resources: [
          {
            uri: "platform://agents",
            name: "Agent Library",
            description: "All available AI agents",
            mimeType: "application/json",
          },
          {
            uri: "platform://projects",
            name: "Projects",
            description: "All platform projects",
            mimeType: "application/json",
          },
        ],
      };

    case "resources/read": {
      const uri = params.uri as string;
      if (uri === "platform://agents") {
        const agents = db.select().from(agentsTable).all();
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(agents) }] };
      }
      if (uri === "platform://projects") {
        const projects = db.select().from(projectsTable).all();
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(projects) }] };
      }
      throw new Error(`Unknown resource: ${uri}`);
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_projects": {
      const projects = db.select().from(projectsTable).all();
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
    }

    case "list_agents": {
      let agents = db.select().from(agentsTable).all();
      if (args.category) agents = agents.filter(a => a.category === args.category);
      return { content: [{ type: "text", text: JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, category: a.category, description: a.description })), null, 2) }] };
    }

    case "create_project": {
      const { randomUUID } = await import("crypto");
      const project = {
        id: randomUUID(),
        name: args.name as string,
        description: (args.description as string) || null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.insert(projectsTable).values(project).run();
      return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
    }

    case "get_project_artifacts": {
      const artifacts = db.select().from(artifactsTable)
        .where(eq(artifactsTable.projectId, args.projectId as string)).all();
      return { content: [{ type: "text", text: JSON.stringify(artifacts.map(a => ({ id: a.id, filename: a.filename, contentType: a.contentType, sizeBytes: a.sizeBytes })), null, 2) }] };
    }

    case "search_project_memory": {
      const { ragManager } = await import("../lib/rag-manager.js");
      const results = await ragManager.search(args.projectId as string, args.query as string, (args.topK as number) || 5);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    case "get_project_summary": {
      const pid = args.projectId as string;
      const project = db.select().from(projectsTable).where(eq(projectsTable.id, pid)).get();
      if (!project) throw new Error("Project not found");
      const tasks = db.select().from(tasksTable).where(eq(tasksTable.projectId, pid)).all();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            project,
            taskCount: tasks.length,
            completedTasks: tasks.filter(t => t.status === "completed").length,
            pendingTasks: tasks.filter(t => t.status === "pending").length,
            tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
          }, null, 2),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default router;
