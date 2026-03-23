import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { embeddingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler, Errors } from "../lib/error-handler.js";
import { ragManager } from "../lib/rag-manager.js";

const router: IRouter = Router();

/**
 * Semantic search within a project
 */
router.post("/projects/:id/search", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const { query, topK } = req.body as { query: string; topK?: number };

  if (!query) throw Errors.validation("query is required");

  const results = await ragManager.search(projectId, query, topK || 5);
  res.json({ results, total: results.length, query });
}));

/**
 * Index content manually
 */
router.post("/projects/:id/index", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const { content, sourceType, sourceId, metadata } = req.body as {
    content: string;
    sourceType?: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  };

  if (!content) throw Errors.validation("content is required");

  const id = await ragManager.indexContent({
    projectId,
    content,
    sourceType: sourceType || "manual",
    sourceId,
    metadata,
  });

  res.status(201).json({ id, message: "Content indexed" });
}));

/**
 * Batch index all existing project content
 */
router.post("/projects/:id/index-all", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const stats = await ragManager.indexProject(projectId);
  res.json({ ...stats, message: "Project indexing complete" });
}));

/**
 * Get RAG stats for a project
 */
router.get("/projects/:id/rag-stats", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const stats = ragManager.getStats(projectId);
  res.json(stats);
}));

/**
 * Clear all embeddings for a project
 */
router.delete("/projects/:id/embeddings", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  ragManager.clearProject(projectId);
  res.json({ success: true, message: "All embeddings cleared" });
}));

export default router;
