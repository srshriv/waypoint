import { z } from "zod";
import { environmentService } from "./environment.service.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Provide a valid environment id.");
const name = z.string().trim().min(1).max(60);

const createSchema = z
	.object({
		name,
		rank: z.int().min(0).max(20).optional(),
		requiresHealthCheck: z.boolean().default(true),
	})
	.strict();

const updateSchema = z
	.object({ name: name.optional(), requiresHealthCheck: z.boolean().optional() })
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

const reorderSchema = z.object({ environmentIds: z.array(objectId).min(1).max(21) }).strict();

export async function listEnvironments(request, response, next) {
	try {
		response.json({ data: await environmentService.list(request.params.projectId, request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function createEnvironment(request, response, next) {
	try {
		response
			.status(201)
			.json({ data: await environmentService.create(request.params.projectId, createSchema.parse(request.body), request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function updateEnvironment(request, response, next) {
	try {
		const input = updateSchema.parse(request.body);
		response.json({
			data: await environmentService.update(request.params.projectId, request.params.environmentId, input, request.profileId),
		});
	} catch (error) {
		next(error);
	}
}

export async function reorderEnvironments(request, response, next) {
	try {
		const { environmentIds } = reorderSchema.parse(request.body);
		response.json({ data: await environmentService.reorder(request.params.projectId, environmentIds, request.profileId) });
	} catch (error) {
		next(error);
	}
}
