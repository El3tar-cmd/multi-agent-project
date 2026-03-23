import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import projectsRouter from "./projects.js";
import tasksRouter from "./tasks.js";
import ollamaRouter from "./ollama.js";
import orchestratorRouter from "./orchestrator.js";
import artifactsRouter from "./artifacts.js";
import mcpRouter from "./mcp.js";
import exportRouter from "./export.js";
import collaborationsRouter from "./collaborations.js";
import ragRouter from "./rag.js";
import mcpServerRouter from "./mcp-server.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(ollamaRouter);
router.use(orchestratorRouter);
router.use(artifactsRouter);
router.use(mcpRouter);
router.use(exportRouter);
router.use(collaborationsRouter);
router.use(ragRouter);
router.use(mcpServerRouter);

export default router;
