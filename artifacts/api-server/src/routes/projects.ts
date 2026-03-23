import { Router, type IRouter, type Request, type Response } from "express";
import { db, rawDb } from "@workspace/db";
import { projectsTable, tasksTable, contextTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler, Errors } from "../lib/error-handler.js";

const router: IRouter = Router();

router.get("/projects", asyncHandler(async (_req, res) => {
  const projects = db.select().from(projectsTable).all();
  res.json({ projects });
}));

router.post("/projects", asyncHandler(async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name) throw Errors.validation("name is required");

  const project = {
    id: randomUUID(),
    name,
    description: description || null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.insert(projectsTable).values(project).run();
  res.status(201).json(project);
}));

router.get("/projects/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
  if (!project) throw Errors.notFound("Project", id);
  res.json(project);
}));

router.delete("/projects/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
  if (!project) throw Errors.notFound("Project", id);

  // With CASCADE FKs, deleting project auto-deletes tasks, messages, context
  // But we still delete in order for safety with older DBs without FK enforcement
  const tasks = db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).all();
  for (const task of tasks) {
    db.delete(messagesTable).where(eq(messagesTable.taskId, task.id)).run();
  }
  db.delete(tasksTable).where(eq(tasksTable.projectId, id)).run();
  db.delete(contextTable).where(eq(contextTable.projectId, id)).run();
  db.delete(projectsTable).where(eq(projectsTable.id, id)).run();

  res.json({ success: true, message: "Project deleted" });
}));

router.patch("/projects/:id", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
  if (!project) throw Errors.notFound("Project", id);

  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).run();
  
  const updatedProject = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
  res.json(updatedProject);
}));

router.get("/projects/:id/tasks", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const tasks = db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).all();
  res.json({ tasks });
}));

router.get("/projects/:id/context", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const contextMap = db.select().from(contextTable).where(eq(contextTable.projectId, id)).all();
  res.json({ context: contextMap });
}));

export default router;

