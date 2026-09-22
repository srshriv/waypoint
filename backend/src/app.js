import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./features/auth/auth.routes.js";
import { dashboardRouter } from "./features/dashboard/dashboard.routes.js";
import { deploymentRouter } from "./features/deployments/deployment.routes.js";
import { environmentRouter } from "./features/environments/environment.routes.js";
import { profileRouter } from "./features/members/member.routes.js";
import { projectRouter } from "./features/projects/project.routes.js";
import { releaseRouter } from "./features/releases/release.routes.js";
import { variableRouter } from "./features/variables/variable.routes.js";
import { errorHandler, notFoundHandler } from "./shared/middleware/error-handler.js";
import { requireWorkspaceAuth } from "./shared/middleware/auth.js";
import { resolveProfileContext } from "./shared/middleware/profile-context.js";

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export function createApp() {
	const app = express();
	app.disable("x-powered-by");
	app.use(cors());
	app.use(express.json({ limit: "100kb" }));
	app.use(express.static(publicDirectory));
	app.get("/api/v1/health", (request, response) => {
		const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
		response
			.status(database === "connected" ? 200 : 503)
			.json({ data: { status: database === "connected" ? "ok" : "degraded", database } });
	});
	app.use("/api/v1/auth", authRouter);
	app.use("/api/v1/profiles", requireWorkspaceAuth, profileRouter);
	app.use("/api/v1/dashboard", requireWorkspaceAuth, resolveProfileContext, dashboardRouter);
	app.use("/api/v1/projects/:projectId/deployments", requireWorkspaceAuth, resolveProfileContext, deploymentRouter);
	app.use("/api/v1/projects/:projectId/environments", requireWorkspaceAuth, resolveProfileContext, environmentRouter);
	app.use(
		"/api/v1/projects/:projectId/environments/:environmentId/variables",
		requireWorkspaceAuth,
		resolveProfileContext,
		variableRouter,
	);
	app.use("/api/v1/projects/:projectId/releases", requireWorkspaceAuth, resolveProfileContext, releaseRouter);
	app.use("/api/v1/projects", requireWorkspaceAuth, resolveProfileContext, projectRouter);
	app.use(notFoundHandler);
	app.use(errorHandler);
	return app;
}
