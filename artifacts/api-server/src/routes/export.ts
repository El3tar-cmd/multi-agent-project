import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, messagesTable, contextTable, agentsTable, artifactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler, Errors } from "../lib/error-handler.js";

const router: IRouter = Router();

/**
 * Export a project with all its data in various formats
 */
router.get("/projects/:id/export", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const format = (req.query.format as string) || "md";

  const project = db.select().from(projectsTable)
    .where(eq(projectsTable.id, id)).get();
  if (!project) throw Errors.notFound("Project", id);

  // Gather all data
  const tasks = db.select().from(tasksTable)
    .where(eq(tasksTable.projectId, id)).all();
  
  const allMessages: Record<string, any[]> = {};
  for (const task of tasks) {
    allMessages[task.id] = db.select().from(messagesTable)
      .where(eq(messagesTable.taskId, task.id)).all();
  }

  const contextItems = db.select().from(contextTable)
    .where(eq(contextTable.projectId, id)).all();

  const artifacts = db.select().from(artifactsTable)
    .where(eq(artifactsTable.projectId, id)).all();

  // Get agent names
  const agentMap = new Map<string, string>();
  const agents = db.select().from(agentsTable).all();
  for (const a of agents) agentMap.set(a.id, a.name);

  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${project.name}.json"`);
    res.json({
      project,
      tasks: tasks.map(t => ({
        ...t,
        agentName: t.agentId ? agentMap.get(t.agentId) : null,
        messages: allMessages[t.id] || [],
      })),
      context: contextItems,
      artifacts: artifacts.map(({ content, ...meta }) => meta),
      exportedAt: new Date().toISOString(),
    });
    return;
  }

  if (format === "html") {
    const html = generateHTML(project, tasks, allMessages, contextItems, artifacts, agentMap);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `attachment; filename="${project.name}.html"`);
    res.send(html);
    return;
  }

  // Default: Markdown
  const md = generateMarkdown(project, tasks, allMessages, contextItems, artifacts, agentMap);
  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name}.md"`);
  res.send(md);
}));

// ---------- Generators ----------

function generateMarkdown(
  project: any, tasks: any[], messages: Record<string, any[]>,
  context: any[], artifacts: any[], agentMap: Map<string, string>
): string {
  const lines: string[] = [];
  
  lines.push(`# ${project.name}`);
  lines.push(`> ${project.description || "No description"}`);
  lines.push(`> Status: ${project.status} | Created: ${project.createdAt}`);
  lines.push("");

  // Tasks
  lines.push(`## Tasks (${tasks.length})`);
  lines.push("");
  
  for (const task of tasks) {
    const agentName = task.agentId ? agentMap.get(task.agentId) || "Unknown" : "Unassigned";
    const statusEmoji = task.status === "completed" ? "✅" : task.status === "running" ? "🔄" : "⏳";
    
    lines.push(`### ${statusEmoji} ${task.title}`);
    lines.push(`- **Agent**: ${agentName}`);
    lines.push(`- **Status**: ${task.status}`);
    lines.push(`- **Model**: ${task.model || "default"}`);
    if (task.description) lines.push(`- **Description**: ${task.description}`);
    lines.push("");

    // Messages
    const taskMsgs = messages[task.id] || [];
    if (taskMsgs.length > 0) {
      lines.push("#### Conversation");
      for (const msg of taskMsgs) {
        const role = msg.role === "assistant" ? `🤖 ${agentName}` : "👤 User";
        lines.push(`**${role}**:`);
        lines.push(msg.content);
        lines.push("");
      }
    }

    // Result
    if (task.result) {
      lines.push("#### Result");
      lines.push(task.result);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Artifacts
  if (artifacts.length > 0) {
    lines.push(`## Artifacts (${artifacts.length})`);
    lines.push("");
    for (const art of artifacts) {
      lines.push(`### 📄 ${art.filename}`);
      lines.push(`- Type: ${art.contentType} | Size: ${art.sizeBytes} bytes`);
      if (art.content) {
        const lang = art.language || "";
        lines.push("```" + lang);
        lines.push(art.content);
        lines.push("```");
      }
      lines.push("");
    }
  }

  // Context/Memory
  if (context.length > 0) {
    lines.push(`## Project Memory (${context.length} items)`);
    lines.push("");
    for (const ctx of context) {
      lines.push(`- **${ctx.key}**: ${ctx.value.substring(0, 200)}${ctx.value.length > 200 ? "..." : ""}`);
    }
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`*Exported from Multi-Agent Platform on ${new Date().toISOString()}*`);

  return lines.join("\n");
}

function generateHTML(
  project: any, tasks: any[], messages: Record<string, any[]>,
  context: any[], artifacts: any[], agentMap: Map<string, string>
): string {
  const md = generateMarkdown(project, tasks, messages, context, artifacts, agentMap);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 900px; margin: 0 auto; padding: 2rem; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #fff; margin-bottom: 0.5rem; font-size: 2rem; }
    h2 { color: #a78bfa; margin: 2rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    h3 { color: #60a5fa; margin: 1.5rem 0 0.5rem; }
    h4 { color: #9ca3af; margin: 1rem 0 0.5rem; }
    blockquote { border-left: 3px solid #6366f1; padding-left: 1rem; color: #9ca3af; margin: 0.5rem 0; }
    pre { background: #1a1a2e; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.5rem 0; }
    code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    hr { border: none; border-top: 1px solid #333; margin: 1.5rem 0; }
    strong { color: #fff; }
    p { margin: 0.5rem 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div id="content">${escapeHtml(md).replace(/\n/g, "<br>")}</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default router;
