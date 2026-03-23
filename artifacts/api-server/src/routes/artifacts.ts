import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { artifactsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler, Errors } from "../lib/error-handler.js";

const router: IRouter = Router();

/**
 * List artifacts for a project
 */
router.get("/projects/:id/artifacts", asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const artifacts = db.select().from(artifactsTable)
    .where(eq(artifactsTable.projectId, projectId))
    .all();
  
  // Return without content for listing (lighter payload)
  const listing = artifacts.map(({ content, ...meta }) => ({
    ...meta,
    hasContent: !!content,
  }));
  
  res.json({ artifacts: listing, total: listing.length });
}));

/**
 * Create artifact manually or from task output
 */
router.post("/projects/:projectId/artifacts", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const { filename, content, contentType, language, taskId } = req.body as {
    filename: string;
    content: string;
    contentType?: string;
    language?: string;
    taskId?: string;
  };

  if (!filename || !content) {
    throw Errors.validation("filename and content are required");
  }

  const artifact = {
    id: randomUUID(),
    projectId,
    taskId: taskId || null,
    filename,
    contentType: contentType || detectContentType(filename),
    content,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    language: language || detectLanguage(filename),
    createdAt: new Date().toISOString(),
  };

  db.insert(artifactsTable).values(artifact).run();
  res.status(201).json(artifact);
}));

/**
 * Get a single artifact with its content
 */
router.get("/artifacts/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const artifact = db.select().from(artifactsTable)
    .where(eq(artifactsTable.id, id))
    .get();
  
  if (!artifact) throw Errors.notFound("Artifact", id);
  res.json(artifact);
}));

/**
 * Download artifact as a raw file
 */
router.get("/artifacts/:id/download", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const artifact = db.select().from(artifactsTable)
    .where(eq(artifactsTable.id, id))
    .get();
  
  if (!artifact) throw Errors.notFound("Artifact", id);
  
  res.setHeader("Content-Type", artifact.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${artifact.filename}"`);
  res.send(artifact.content);
}));

/**
 * Delete artifact
 */
router.delete("/artifacts/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const artifact = db.select().from(artifactsTable)
    .where(eq(artifactsTable.id, id))
    .get();
  
  if (!artifact) throw Errors.notFound("Artifact", id);
  
  db.delete(artifactsTable).where(eq(artifactsTable.id, id)).run();
  res.json({ success: true, message: "Artifact deleted" });
}));

/**
 * List artifacts for a specific task
 */
router.get("/tasks/:id/artifacts", asyncHandler(async (req, res) => {
  const taskId = req.params.id as string;
  const artifacts = db.select().from(artifactsTable)
    .where(eq(artifactsTable.taskId, taskId))
    .all();
  
  const listing = artifacts.map(({ content, ...meta }) => ({
    ...meta,
    hasContent: !!content,
  }));
  
  res.json({ artifacts: listing, total: listing.length });
}));

/**
 * Create artifact from task output (used internally after task completion)
 */
router.post("/tasks/:id/artifacts", asyncHandler(async (req, res) => {
  const taskId = req.params.id as string;
  const { filename, content, contentType, language, projectId } = req.body as {
    filename: string;
    content: string;
    contentType?: string;
    language?: string;
    projectId: string;
  };

  if (!filename || !content || !projectId) {
    throw Errors.validation("filename, content, and projectId are required");
  }

  const artifact = {
    id: randomUUID(),
    projectId,
    taskId,
    filename,
    contentType: contentType || detectContentType(filename),
    content,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    language: language || detectLanguage(filename),
    createdAt: new Date().toISOString(),
  };

  db.insert(artifactsTable).values(artifact).run();
  res.status(201).json(artifact);
}));

// ---------- Helpers ----------

function detectContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "application/javascript",
    ts: "application/typescript",
    jsx: "application/javascript",
    tsx: "application/typescript",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    md: "text/markdown",
    py: "text/x-python",
    sql: "application/sql",
    yaml: "text/yaml",
    yml: "text/yaml",
    xml: "application/xml",
    sh: "application/x-sh",
    txt: "text/plain",
  };
  return map[ext || ""] || "text/plain";
}

function detectLanguage(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    py: "python",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sh: "bash",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    php: "php",
    c: "c",
    cpp: "cpp",
    h: "c",
  };
  return map[ext || ""] || null;
}

/**
 * Parse code blocks from AI response text and create artifacts.
 * Detects ``` blocks with optional filename or language hints.
 */
export function extractArtifactsFromContent(content: string): Array<{
  filename: string;
  content: string;
  language: string | null;
}> {
  const artifacts: Array<{ filename: string; content: string; language: string | null }> = [];
  // Match ```language:filename or ```filename.ext
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  let fileIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1] || "";
    const explicitName = match[2]?.trim();
    const code = match[3]?.trim();
    
    if (!code || code.length < 10) continue; // skip tiny snippets
    
    fileIndex++;
    const extMap: Record<string, string> = {
      javascript: "js", typescript: "ts", python: "py",
      html: "html", css: "css", json: "json", sql: "sql",
      bash: "sh", shell: "sh", yaml: "yaml", xml: "xml",
      rust: "rs", go: "go", java: "java", ruby: "rb",
      php: "php", c: "c", cpp: "cpp", markdown: "md",
      jsx: "jsx", tsx: "tsx",
    };
    
    const ext = extMap[lang.toLowerCase()] || lang.toLowerCase() || "txt";
    const filename = explicitName || `file_${fileIndex}.${ext}`;
    
    artifacts.push({
      filename,
      content: code,
      language: lang || null,
    });
  }

  return artifacts;
}

export default router;
