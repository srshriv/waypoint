import { Router } from "express";
import { archiveProject, createProject, listProjects, restoreProject, updateProject } from "./project.controller.js";

export const projectRouter = Router();
projectRouter.get("/", listProjects);
projectRouter.post("/", createProject);
projectRouter.patch("/:projectId", updateProject);
projectRouter.post("/:projectId/archive", archiveProject);
projectRouter.post("/:projectId/restore", restoreProject);
