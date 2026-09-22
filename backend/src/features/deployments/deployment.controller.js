import { z } from "zod";
import { deploymentService } from "./deployment.service.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Provide a valid id.");

const listSchema = z.object({ environmentId: objectId.optional() }).strict();
const logsSchema = z.object({ after: z.coerce.number().int().min(0).max(1_000_000).default(0) }).strict();
const requestKey = z.string().trim().min(8).max(120);
const triggerSchema = z.object({ environmentId: objectId, releaseId: objectId, requestKey }).strict();
const promoteSchema = z.object({ sourceEnvironmentId: objectId, targetEnvironmentId: objectId, requestKey }).strict();
const rollbackSchema = z.object({ environmentId: objectId, targetDeploymentId: objectId, requestKey }).strict();
const rollbackTargetsSchema = z.object({ environmentId: objectId }).strict();

const actingProfile = (request) => ({
    profileId: request.profileId,
    role: request.profile.role,
    name: request.profile.name,
});

export async function listDeployments(request, response, next) {
    try {
        const { environmentId } = listSchema.parse(request.query);
        response.json({ data: await deploymentService.list(request.params.projectId, environmentId, request.profileId) });
    } catch (error) { next(error); }
}

export async function getDeployment(request, response, next) {
    try {
        response.json({ data: await deploymentService.get(request.params.projectId, request.params.deploymentId, request.profileId) });
    } catch (error) { next(error); }
}

export async function getDeploymentLogs(request, response, next) {
    try {
        const { after } = logsSchema.parse(request.query);
        response.json({ data: await deploymentService.logs(request.params.projectId, request.params.deploymentId, after, request.profileId) });
    } catch (error) { next(error); }
}

export async function triggerDeployment(request, response, next) {
    try {
        const input = triggerSchema.parse(request.body);
        const { deployment, reused } = await deploymentService.trigger(request.params.projectId, input, actingProfile(request));
        // A reused request key is not a new deployment, so it answers 200 rather than 201.
        response.status(reused ? 200 : 201).json({ data: { deployment, reused } });
    } catch (error) { next(error); }
}

export async function promoteDeployment(request, response, next) {
    try {
        const input = promoteSchema.parse(request.body);
        const { deployment, reused } = await deploymentService.promote(request.params.projectId, input, actingProfile(request));
        response.status(reused ? 200 : 201).json({ data: { deployment, reused } });
    } catch (error) { next(error); }
}

export async function rollbackDeployment(request, response, next) {
    try {
        const input = rollbackSchema.parse(request.body);
        const { deployment, reused } = await deploymentService.rollback(request.params.projectId, input, actingProfile(request));
        response.status(reused ? 200 : 201).json({ data: { deployment, reused } });
    } catch (error) { next(error); }
}

export async function listRollbackTargets(request, response, next) {
    try {
        const { environmentId } = rollbackTargetsSchema.parse(request.query);
        response.json({ data: await deploymentService.rollbackTargets(request.params.projectId, environmentId, request.profileId) });
    } catch (error) { next(error); }
}
