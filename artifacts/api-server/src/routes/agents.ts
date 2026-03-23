import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadAgentsFromDisk } from "../lib/agent-loader.js";

const router: IRouter = Router();

router.get("/agents", async (req, res) => {
  try {
    const { category, search } = req.query as { category?: string; search?: string };

    let agents = db.select().from(agentsTable).all();

    if (category) {
      agents = agents.filter((a) => a.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.vibe?.toLowerCase().includes(q) ?? false)
      );
    }

    const categories = [...new Set(db.select({ category: agentsTable.category }).from(agentsTable).all().map((a) => a.category))];

    res.json({ agents, total: agents.length, categories });
  } catch (err) {
    req.log.error({ err }, "Failed to list agents");
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.post("/agents/reload", async (req, res) => {
  try {
    const count = await loadAgentsFromDisk();
    res.json({ loaded: count, message: `Loaded ${count} agents from disk` });
  } catch (err) {
    req.log.error({ err }, "Failed to reload agents");
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.get("/agents/:id", async (req, res) => {
  try {
    const agent = db.select().from(agentsTable).where(eq(agentsTable.id, req.params.id)).get();
    if (!agent) return res.status(404).json({ error: "not_found", message: "Agent not found" });
    return res.json(agent);
  } catch (err) {
    return res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
