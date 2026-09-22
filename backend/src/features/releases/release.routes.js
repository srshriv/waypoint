import { Router } from "express";
import { createRelease, diffReleases, listReleases } from "./release.controller.js";

// Cutting a release records a build; it is not an act on an environment, so it is open to
// contributors. Acting on a release, by deploying or promoting it, is gated elsewhere.
export const releaseRouter = Router({ mergeParams: true });
releaseRouter.get("/", listReleases);
releaseRouter.post("/", createRelease);
releaseRouter.get("/diff", diffReleases);
