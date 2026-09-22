import { Router } from "express";
import { listProfiles } from "./member.controller.js";

export const profileRouter = Router();
profileRouter.get("/", listProfiles);
