import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import projectsRouter from "./projects.js";
import tasksRouter from "./tasks.js";
import ollamaRouter from "./ollama.js";
import orchestratorRouter from "./orchestrator.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(ollamaRouter);
router.use(orchestratorRouter);

export default router;
