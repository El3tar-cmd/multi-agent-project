import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";

const router: IRouter = Router();

// Simple keyword-based scoring for agent suggestion
function scoreAgent(agent: { name: string; description: string; vibe?: string | null; category: string }, taskText: string): number {
  const text = taskText.toLowerCase();
  const agentText = `${agent.name} ${agent.description} ${agent.vibe || ""} ${agent.category}`.toLowerCase();

  let score = 0;

  // Category keywords
  const categoryKeywords: Record<string, string[]> = {
    engineering: ["code", "build", "develop", "api", "backend", "frontend", "database", "deploy", "debug", "fix", "implement", "architecture", "software"],
    design: ["design", "ui", "ux", "visual", "brand", "color", "layout", "wireframe", "prototype", "user experience"],
    marketing: ["market", "seo", "content", "social", "campaign", "growth", "brand", "audience", "viral", "traffic"],
    product: ["product", "feature", "roadmap", "user story", "priority", "backlog", "feedback", "mvp"],
    testing: ["test", "qa", "quality", "bug", "performance", "audit", "verify", "validate"],
    support: ["support", "customer", "help", "issue", "ticket", "finance", "legal"],
    sales: ["sales", "deal", "prospect", "lead", "pitch", "revenue", "client"],
    "project-management": ["project", "manage", "schedule", "milestone", "planning", "coordination"],
    academic: ["research", "study", "academic", "analysis", "theory", "history", "psychology"],
    specialized: ["compliance", "blockchain", "identity", "automation", "workflow"],
    "game-development": ["game", "level", "gameplay", "narrative", "audio", "unity", "unreal"],
  };

  const catKw = categoryKeywords[agent.category] || [];
  for (const kw of catKw) {
    if (text.includes(kw)) score += 3;
  }

  // Direct word overlap between task and agent description
  const taskWords = text.split(/\s+/).filter((w) => w.length > 3);
  for (const word of taskWords) {
    if (agentText.includes(word)) score += 1;
  }

  return score;
}

router.post("/orchestrator/suggest", (req: Request, res: Response) => {
  try {
    const { task } = req.body as { task: string; projectId?: string };
    if (!task) return res.status(400).json({ error: "validation_error", message: "task is required" });

    const agents = db.select().from(agentsTable).all();
    if (agents.length === 0) {
      return res.status(503).json({ error: "no_agents", message: "No agents loaded. Reload agents first." });
    }

    const scored = agents
      .map((a) => ({ agent: a, score: scoreAgent(a, task) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const alternatives = scored.slice(1, 4).map((s) => s.agent);

    res.json({
      agent: best.agent,
      reason: `${best.agent.name} scored highest for this task (score: ${best.score}). ${best.agent.vibe || ""}`,
      alternatives,
    });
    return;
  } catch (err) {
    return res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.post("/orchestrator/plan", async (req, res) => {
  try {
    const { prompt, model } = req.body as { prompt: string; model: string };
    if (!prompt || !model) {
      return res.status(400).json({ error: "validation_error", message: "prompt and model are required" });
    }

    const agents = db.select().from(agentsTable).all();
    if (agents.length === 0) {
      return res.status(503).json({ error: "no_agents", message: "No agents loaded. Reload agents first." });
    }

    const agentsList = agents.map(a => `- ${a.name} (ID: ${a.id}): ${a.description}`).join("\n");

    const systemPrompt = `You are an expert AI Project Manager and Orchestrator. The user wants to build a project. Break it down into sequential tasks. Assign the most capable specialized AI agent from the repository to each task, and write a detailed prompt for that agent.

Available Agents:
${agentsList}

You must return ONLY a JSON array of objects. Do not use Markdown backticks. Do not include any other text except the JSON array.
Schema for the array:
[
  {
    "title": "Short descriptive title of the task",
    "agentId": "Exact ID of the assigned agent from the Available Agents list",
    "agentName": "Exact Name of the assigned agent",
    "prompt": "The detailed instructions that this agent will receive to complete the task.",
    "reason": "Why this agent is the best choice."
  }
]`;

    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434";
    const response = await fetch(`${ollamaEndpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        stream: false,
        format: "json", // Instruct Ollama backend to strictly output JSON
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "ollama_error", message: `Ollama error: ${response.status} ${err}` });
    }

    const data = (await response.json()) as any;
    let tasks = [];
    try {
      tasks = JSON.parse(data.message.content);
    } catch (e) {
      // In case Ollama wrapped in backticks despite format: json
      const match = data.message.content.match(/\[[\s\S]*\]/);
      if (match) {
        tasks = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse JSON from LLM: " + data.message.content);
      }
    }

    if (!Array.isArray(tasks)) {
       throw new Error("LLM did not return an array.");
    }

    return res.json({ tasks });
  } catch (err) {
    if ((req as any).log) {
       (req as any).log.error({ err }, "Failed to plan project");
    }
    return res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
