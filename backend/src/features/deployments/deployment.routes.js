import { Router } from "express";
import {
	getDeployment,
	getDeploymentLogs,
	listDeployments,
	listRollbackTargets,
	promoteDeployment,
	rollbackDeployment,
	triggerDeployment,
} from "./deployment.controller.js";

// Role is not gated here. Whether a contributor may deploy depends on the target
// environment's promotion rank, and promotion and rollback both depend on what is currently
// live, so those checks live in the service next to the data they read.
export const deploymentRouter = Router({ mergeParams: true });
deploymentRouter.get("/", listDeployments);
deploymentRouter.post("/", triggerDeployment);
deploymentRouter.get("/rollback-targets", listRollbackTargets);
deploymentRouter.post("/promote", promoteDeployment);
deploymentRouter.post("/rollback", rollbackDeployment);
deploymentRouter.get("/:deploymentId", getDeployment);
deploymentRouter.get("/:deploymentId/logs", getDeploymentLogs);
