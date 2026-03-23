import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { tasksTable, messagesTable, agentsTable, contextTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler, Errors } from "../lib/error-handler.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const DEFAULT_ENDPOINT = "http://localhost:11434";

router.post("/tasks", asyncHandler(async (req, res) => {
  const { projectId, agentId, title, description, model, ollamaEndpoint } = req.body as {
    projectId: string;
    agentId?: string;
    title: string;
    description?: string;
    model?: string;
    ollamaEndpoint?: string;
  };

  if (!projectId || !title) {
    throw Errors.validation("projectId and title are required");
  }

  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    projectId,
    agentId: agentId || null,
    title,
    description: description || null,
    status: "pending",
    result: null,
    model: model || "glm-5:cloud",
    ollamaEndpoint: ollamaEndpoint || DEFAULT_ENDPOINT,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(tasksTable).values(task).run();
  res.status(201).json(task);
}));

router.get("/tasks/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const task = db.select().from(tasksTable).where(eq(tasksTable.id, id)).get();
  if (!task) throw Errors.notFound("Task", id);
  res.json(task);
}));

router.get("/tasks/:id/messages", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const messages = db.select().from(messagesTable).where(eq(messagesTable.taskId, id)).all();
  res.json({ messages });
}));

router.delete("/tasks/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const task = db.select().from(tasksTable).where(eq(tasksTable.id, id)).get();
  if (!task) throw Errors.notFound("Task", id);
  
  // Cleanup related data (CASCADE handles this too but explicit is safer)
  db.delete(contextTable).where(eq(contextTable.key, `task:${task.id}:result`)).run();
  db.delete(messagesTable).where(eq(messagesTable.taskId, task.id)).run();
  db.delete(tasksTable).where(eq(tasksTable.id, task.id)).run();
  
  res.json({ success: true, message: "Task deleted" });
}));

router.patch("/tasks/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const task = db.select().from(tasksTable).where(eq(tasksTable.id, id)).get();
  if (!task) throw Errors.notFound("Task", id);
  
  if (task.status === "running") {
    throw Errors.conflict("Cannot edit a running task");
  }
  
  const { title, model } = req.body as { title?: string; model?: string };
  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (model !== undefined) updates.model = model;
  
  db.update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, task.id))
    .run();
    
  const updatedTask = db.select().from(tasksTable).where(eq(tasksTable.id, task.id)).get();
  res.json(updatedTask);
}));

router.post("/tasks/:id/run", async (req: Request, res: Response) => {
  const {
    message,
    model,
    ollamaEndpoint = DEFAULT_ENDPOINT,
    enableThinking = true,
  } = req.body as {
    message: string;
    model?: string;
    ollamaEndpoint?: string;
    enableThinking?: boolean;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (type: string, payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  try {
    const id = req.params.id as string;
    const task = db.select().from(tasksTable).where(eq(tasksTable.id, id)).get();
    if (!task) {
      sendEvent("error", { error: "Task not found" });
      res.end();
      return;
    }

    // Update task status to running
    db.update(tasksTable)
      .set({ status: "running", updatedAt: new Date().toISOString() })
      .where(eq(tasksTable.id, id))
      .run();

    // Save user message
    const userMsgId = randomUUID();
    db.insert(messagesTable).values({
      id: userMsgId,
      taskId: task.id,
      agentId: task.agentId || null,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    }).run();

    // Get agent system prompt
    let systemPrompt = "You are a helpful AI assistant.";
    if (task.agentId) {
      const agent = db.select().from(agentsTable).where(eq(agentsTable.id, task.agentId)).get();
      if (agent) systemPrompt = agent.systemPrompt;
    }

    // Inject Project Memory (Context) into the Agent's brain
    const projectContexts = db.select().from(contextTable).where(eq(contextTable.projectId, task.projectId)).all();
    if (projectContexts.length > 0) {
      const contextStr = projectContexts.map(c => `[${c.key} from ${c.source}]:\n${c.value}`).join("\n\n");
      systemPrompt += `\n\n--- PROJECT CONTEXT (MEMORY) ---\nYou have access to the following insights and code from previous tasks in this project. Use this context to build upon previous work:\n${contextStr}\n----------------------------------\n`;
    }

    // Get message history for context
    const history = db.select().from(messagesTable).where(eq(messagesTable.taskId, task.id)).all();
    const historyMessages = history.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const selectedModel = model || task.model || "glm-5:cloud";
    const endpoint = ollamaEndpoint || task.ollamaEndpoint || DEFAULT_ENDPOINT;

    const body: Record<string, unknown> = {
      model: selectedModel,
      messages: [{ role: "system", content: systemPrompt }, ...historyMessages],
      stream: true,
    };

    if (enableThinking) body.think = true;

    const r = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });

    if (!r.ok) {
      const errText = await r.text();
      db.update(tasksTable)
        .set({ status: "error", updatedAt: new Date().toISOString() })
        .where(eq(tasksTable.id, id))
        .run();
      sendEvent("error", { error: `Ollama error: ${r.status} ${errText}` });
      res.end();
      return;
    }

    const reader = r.body?.getReader();
    if (!reader) {
      sendEvent("error", { error: "No response body from Ollama" });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullThinking = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string; thinking?: string };
            done?: boolean;
          };

          if (chunk.message?.thinking) {
            fullThinking += chunk.message.thinking;
            sendEvent("thinking", { content: chunk.message.thinking });
          }
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            sendEvent("content", { content: chunk.message.content });
          }
          if (chunk.done) {
            // We'll send the done event manually at the end of total processing
          }
        } catch {
          // skip
        }
      }
    }

    // Save assistant message
    const assistantContent = fullThinking
      ? `<thinking>\n${fullThinking}\n</thinking>\n\n${fullContent}`
      : fullContent;

    db.insert(messagesTable).values({
      id: randomUUID(),
      taskId: task.id,
      agentId: task.agentId || null,
      role: "assistant",
      content: assistantContent,
      createdAt: new Date().toISOString(),
    }).run();

    // Save to context (Project Memory)
    if (fullContent) {
      db.insert(contextTable).values({
        id: randomUUID(),
        projectId: task.projectId,
        key: `Task: ${task.title}`,
        value: fullContent.slice(0, 32000),
        source: task.agentId || "assistant",
        createdAt: new Date().toISOString(),
      }).run();
    }

    // Update task status to done
    db.update(tasksTable)
      .set({ status: "done", result: fullContent.slice(0, 5000), updatedAt: new Date().toISOString() })
      .where(eq(tasksTable.id, id))
      .run();

    sendEvent("done", {});
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error("FATAL ERROR IN RUN TASK:", err);
    const id = req.params.id as string;
    try {
      db.update(tasksTable)
        .set({ status: "error", updatedAt: new Date().toISOString() })
        .where(eq(tasksTable.id, id))
        .run();
    } catch (dbErr) {
      console.error("ERROR UPDATING ERROR STATUS:", dbErr);
    }
    sendEvent("error", { error: String(err) });
    if (!res.writableEnded) res.end();
  }
});

export default router;
