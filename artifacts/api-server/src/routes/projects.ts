import { Router, type IRouter, type Request, type Response } from "express";
import { db, rawDb } from "@workspace/db";
import { projectsTable, tasksTable, contextTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/projects", (_req, res) => {
  try {
    const projects = db.select().from(projectsTable).all();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.post("/projects", (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as { name: string; description?: string };

    if (!name) {
      res.status(400).json({ error: "validation_error", message: "name is required" });
      return;
    }

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
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.get("/projects/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
    if (!project) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.delete("/projects/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
    if (!project) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    const tasks = db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).all();
    for (const task of tasks) {
      db.delete(messagesTable).where(eq(messagesTable.taskId, task.id)).run();
    }
    db.delete(tasksTable).where(eq(tasksTable.projectId, id)).run();
    db.delete(contextTable).where(eq(contextTable.projectId, id)).run();

    db.delete(projectsTable).where(eq(projectsTable.id, id)).run();
    res.json({ success: true, message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.patch("/projects/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
    if (!project) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    const { name, description } = req.body as { name?: string; description?: string };
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).run();
    
    const updatedProject = db.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
    res.json(updatedProject);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.get("/projects/:id/tasks", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const tasks = db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).all();
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.get("/projects/:id/context", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const contextMap = db.select().from(contextTable).where(eq(contextTable.projectId, id)).all();
    res.json({ context: contextMap });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
