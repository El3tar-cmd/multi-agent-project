import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { collaborationsTable, collaborationMessagesTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler, Errors } from "../lib/error-handler.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const DEFAULT_ENDPOINT = "http://localhost:11434";

/**
 * List collaborations for a project
 */
router.get("/projects/:id/collaborations", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const collabs = db.select().from(collaborationsTable)
    .where(eq(collaborationsTable.projectId, projectId)).all();
  res.json({ collaborations: collabs.map(c => ({ ...c, agents: JSON.parse(c.agents) })) });
}));

/**
 * Create and start a multi-agent collaboration session
 */
router.post("/collaborations", asyncHandler(async (req, res) => {
  const { projectId, title, prompt, agentIds, pattern, maxRounds, model } = req.body as {
    projectId: string;
    title: string;
    prompt: string;
    agentIds: string[];
    pattern?: string;
    maxRounds?: number;
    model?: string;
  };

  if (!projectId || !title || !prompt || !agentIds?.length) {
    throw Errors.validation("projectId, title, prompt, and agentIds are required");
  }
  if (agentIds.length < 2) {
    throw Errors.validation("At least 2 agents are required for collaboration");
  }

  const collab = {
    id: randomUUID(),
    projectId,
    title,
    prompt,
    agents: JSON.stringify(agentIds),
    pattern: pattern || "round-robin",
    maxRounds: maxRounds || 3,
    status: "pending",
    model: model || "glm-5:cloud",
    createdAt: new Date().toISOString(),
  };

  db.insert(collaborationsTable).values(collab).run();
  res.status(201).json({ ...collab, agents: agentIds });
}));

/**
 * Get collaboration with messages
 */
router.get("/collaborations/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const collab = db.select().from(collaborationsTable)
    .where(eq(collaborationsTable.id, id)).get();
  if (!collab) throw Errors.notFound("Collaboration", id);

  const messages = db.select().from(collaborationMessagesTable)
    .where(eq(collaborationMessagesTable.collaborationId, id)).all();

  res.json({
    ...collab,
    agents: JSON.parse(collab.agents),
    messages,
  });
}));

/**
 * Run collaboration via SSE streaming
 * Pattern: Round-Robin — each agent takes turns responding
 */
router.post("/collaborations/:id/run", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const collab = db.select().from(collaborationsTable)
    .where(eq(collaborationsTable.id, id)).get();

  if (!collab) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const agentIds: string[] = JSON.parse(collab.agents);
  const agents = agentIds.map(aid =>
    db.select().from(agentsTable).where(eq(agentsTable.id, aid)).get()
  ).filter(Boolean) as any[];

  if (agents.length < 2) {
    res.status(400).json({ error: "Not enough valid agents" });
    return;
  }

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Mark as running
  db.update(collaborationsTable)
    .set({ status: "running" })
    .where(eq(collaborationsTable.id, id)).run();

  try {
    const conversationHistory: Array<{ role: string; content: string }> = [];
    const ollamaEndpoint = DEFAULT_ENDPOINT;
    const model = collab.model || "glm-5:cloud";

    sendEvent({ type: "start", agents: agents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji })), maxRounds: collab.maxRounds });

    for (let round = 1; round <= collab.maxRounds; round++) {
      sendEvent({ type: "round_start", round });

      for (const agent of agents) {
        sendEvent({ type: "agent_start", agentId: agent.id, agentName: agent.name, round });

        // Build messages for this agent
        const systemPrompt = `${agent.systemPrompt}\n\nYou are participating in a multi-agent collaboration. The topic is: "${collab.prompt}"\nThis is round ${round} of ${collab.maxRounds}. Other agents will also respond. Build on their contributions, offer different perspectives, and work toward a solution.`;

        const ollamaMessages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          ...(round === 1 && conversationHistory.length === 0
            ? [{ role: "user", content: collab.prompt }]
            : []),
        ];

        // Call Ollama
        let agentResponse = "";
        try {
          const ollamaRes = await fetch(`${ollamaEndpoint}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
          });

          if (!ollamaRes.ok || !ollamaRes.body) {
            throw new Error(`Ollama error: ${ollamaRes.status}`);
          }

          const reader = ollamaRes.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  agentResponse += parsed.message.content;
                  sendEvent({
                    type: "content",
                    agentId: agent.id,
                    agentName: agent.name,
                    content: parsed.message.content,
                    round,
                  });
                }
              } catch {}
            }
          }
        } catch (err: any) {
          sendEvent({ type: "agent_error", agentId: agent.id, error: err.message });
          agentResponse = `[Error: ${err.message}]`;
        }

        // Save message
        db.insert(collaborationMessagesTable).values({
          id: randomUUID(),
          collaborationId: id,
          agentId: agent.id,
          agentName: agent.name,
          role: "assistant",
          content: agentResponse,
          round,
          createdAt: new Date().toISOString(),
        }).run();

        // Add to history for next agents
        conversationHistory.push({
          role: "assistant",
          content: `[${agent.name}]: ${agentResponse}`,
        });

        sendEvent({ type: "agent_done", agentId: agent.id, agentName: agent.name, round });
      }

      sendEvent({ type: "round_done", round });
    }

    // Mark completed
    db.update(collaborationsTable)
      .set({ status: "completed" })
      .where(eq(collaborationsTable.id, id)).run();

    sendEvent({ type: "done" });
  } catch (err: any) {
    logger.error({ err, collaborationId: id }, "Collaboration failed");
    db.update(collaborationsTable)
      .set({ status: "failed" })
      .where(eq(collaborationsTable.id, id)).run();
    sendEvent({ type: "error", error: err.message });
  }

  res.end();
});

/**
 * Delete collaboration
 */
router.delete("/collaborations/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const collab = db.select().from(collaborationsTable)
    .where(eq(collaborationsTable.id, id)).get();
  if (!collab) throw Errors.notFound("Collaboration", id);

  db.delete(collaborationMessagesTable).where(eq(collaborationMessagesTable.collaborationId, id)).run();
  db.delete(collaborationsTable).where(eq(collaborationsTable.id, id)).run();
  res.json({ success: true });
}));

export default router;
