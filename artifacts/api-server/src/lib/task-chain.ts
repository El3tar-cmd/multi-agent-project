import { db } from "@workspace/db";
import { tasksTable, agentsTable, contextTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";

/**
 * TaskChainManager handles automatic sequential execution of tasks.
 * 
 * When a task completes, the manager checks if any tasks in the same project:
 * 1. Have `autoRun = 1`
 * 2. Have all their `dependsOn` tasks completed
 * 3. Are still in "pending" status
 * 
 * If so, it triggers them automatically.
 */
export class TaskChainManager {
  
  /**
   * Check and trigger next tasks after a task completes.
   * Called internally after a task finishes execution.
   */
  async onTaskCompleted(completedTaskId: string, projectId: string): Promise<string[]> {
    const triggeredTaskIds: string[] = [];

    // Get all pending auto-run tasks in this project
    const projectTasks = db.select().from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .all();

    const pendingAutoRunTasks = projectTasks.filter(
      (t) => t.status === "pending" && t.autoRun === 1
    );

    for (const task of pendingAutoRunTasks) {
      // Parse dependencies
      const deps: string[] = task.dependsOn ? JSON.parse(task.dependsOn) : [];
      
      if (deps.length === 0) continue; // No deps = manual trigger only

      // Check if ALL dependencies are completed
      const allDepsCompleted = deps.every((depId) => {
        const depTask = projectTasks.find((t) => t.id === depId);
        return depTask && depTask.status === "completed";
      });

      if (allDepsCompleted) {
        logger.info(
          { taskId: task.id, title: task.title, triggeredBy: completedTaskId },
          "Auto-triggering chained task"
        );
        triggeredTaskIds.push(task.id);
      }
    }

    return triggeredTaskIds;
  }

  /**
   * Get the ordered task execution plan for a project.
   * Returns tasks sorted by orderIndex and dependency chain.
   */
  getExecutionPlan(projectId: string) {
    const tasks = db.select().from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .all();

    // Sort by orderIndex
    tasks.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      agentId: t.agentId,
      orderIndex: t.orderIndex,
      dependsOn: t.dependsOn ? JSON.parse(t.dependsOn) : [],
      autoRun: t.autoRun === 1,
    }));
  }

  /**
   * Set up a linear chain: each task depends on the previous one.
   * Used when creating project from AI planner.
   */
  setupLinearChain(projectId: string) {
    const tasks = db.select().from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .all();

    // Sort by orderIndex
    tasks.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    for (let i = 1; i < tasks.length; i++) {
      const prevTaskId = tasks[i - 1].id;
      db.update(tasksTable)
        .set({
          dependsOn: JSON.stringify([prevTaskId]),
          autoRun: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasksTable.id, tasks[i].id))
        .run();
    }

    logger.info({ projectId, taskCount: tasks.length }, "Linear task chain configured");
  }

  /**
   * Collect accumulated context from completed predecessor tasks.
   * Injects into the system prompt of the next task.
   */
  gatherPredecessorContext(taskId: string, projectId: string): string {
    const tasks = db.select().from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .all();

    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return "";

    const deps: string[] = currentTask.dependsOn 
      ? JSON.parse(currentTask.dependsOn) 
      : [];

    if (deps.length === 0) return "";

    const contextParts: string[] = [];
    for (const depId of deps) {
      const depTask = tasks.find((t) => t.id === depId);
      if (depTask && depTask.result) {
        contextParts.push(
          `--- Previous Task: ${depTask.title} ---\n${depTask.result}\n`
        );
      }
    }

    return contextParts.length > 0
      ? `\n\n## Context from Previous Tasks:\n${contextParts.join("\n")}`
      : "";
  }
}

// Singleton
export const taskChainManager = new TaskChainManager();
