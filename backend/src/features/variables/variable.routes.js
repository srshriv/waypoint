import { Router } from "express";
import { createVariable, deleteVariable, listVariables, revealVariable, updateVariable } from "./variable.controller.js";
import { requireRole } from "../../shared/middleware/require-role.js";

// Reading the masked list is open: contributors need to see which keys an environment sets,
// and non-secret values are not sensitive. Everything that writes configuration, and the one
// read that discloses a secret in the clear, is a release-manager decision. These checks do
// not depend on the record, so they belong on the route rather than in the service.
const releaseManagerOnly = requireRole("releaseManager");

export const variableRouter = Router({ mergeParams: true });
variableRouter.get("/", listVariables);
variableRouter.post("/", releaseManagerOnly, createVariable);
variableRouter.patch("/:variableId", releaseManagerOnly, updateVariable);
variableRouter.delete("/:variableId", releaseManagerOnly, deleteVariable);
// POST rather than GET: revealing is an action, and keeping it out of a URL keeps secrets out
// of caches, proxy logs and browser history.
variableRouter.post("/:variableId/reveal", releaseManagerOnly, revealVariable);
