import { Router } from "express";
import { getOverview } from "./dashboard.controller.js";

// Read-only and open to both roles: the dashboard reports state, it never changes any.
export const dashboardRouter = Router();
dashboardRouter.get("/", getOverview);
