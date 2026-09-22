import { Router } from "express";
import { createEnvironment, listEnvironments, reorderEnvironments, updateEnvironment } from "./environment.controller.js";
import { requireRole } from "../../shared/middleware/require-role.js";

// Environment configuration decides whether a promotion gate applies and in what order
// builds advance, so every mutation is a release-manager decision. Contributors read only.
const releaseManagerOnly = requireRole("releaseManager");

export const environmentRouter = Router({ mergeParams: true });
environmentRouter.get("/", listEnvironments);
environmentRouter.post("/", releaseManagerOnly, createEnvironment);
environmentRouter.post("/reorder", releaseManagerOnly, reorderEnvironments);
environmentRouter.patch("/:environmentId", releaseManagerOnly, updateEnvironment);
