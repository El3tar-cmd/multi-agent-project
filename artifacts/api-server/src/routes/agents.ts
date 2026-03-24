import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadAgentsFromDisk } from "../lib/agent-loader.js";
import { asyncHandler, Errors } from "../lib/error-handler.js";

const router: IRouter = Router();

router.get("/agents", asyncHandler(async (req, res) => {
  const { category, search } = req.query as { category?: string; search?: string };

  let agents = db.select().from(agentsTable).all().filter((a) => a.isActive);

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
}));

router.post("/agents/reload", asyncHandler(async (_req, res) => {
  const count = await loadAgentsFromDisk();
  res.json({ loaded: count, message: `Loaded ${count} agents from disk` });
}));

router.get("/agents/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const agent = db.select().from(agentsTable).where(eq(agentsTable.id, id)).get();
  if (!agent) throw Errors.notFound("Agent", id);
  res.json(agent);
}));

export default router;
