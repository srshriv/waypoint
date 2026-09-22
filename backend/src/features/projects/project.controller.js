import { z } from "zod";
import { projectService } from "./project.service.js";

const name = z.string().trim().min(1).max(80);
const slug = z
	.string()
	.trim()
	.toLowerCase()
	.min(1)
	.max(60)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
const description = z.string().trim().max(1000);
const repositoryUrl = z.union([
	z.literal(""),
	z
		.string()
		.trim()
		.max(500)
		.refine((value) => /^https?:\/\/\S+$/i.test(value), "Provide an http or https repository URL."),
]);

const listSchema = z.object({ status: z.enum(["active", "archived", "all"]).default("active") }).strict();
const createSchema = z
	.object({
		name,
		slug,
		description: description.default(""),
		repositoryUrl: repositoryUrl.default(""),
	})
	.strict();
const updateSchema = z
	.object({ name: name.optional(), slug: slug.optional(), description: description.optional(), repositoryUrl: repositoryUrl.optional() })
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export async function listProjects(request, response, next) {
	try {
		const { status } = listSchema.parse(request.query);
		response.json({ data: await projectService.list(request.profileId, status) });
	} catch (error) {
		next(error);
	}
}

export async function createProject(request, response, next) {
	try {
		response.status(201).json({ data: await projectService.create(createSchema.parse(request.body), request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function updateProject(request, response, next) {
	try {
		response.json({ data: await projectService.update(request.params.projectId, updateSchema.parse(request.body), request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function archiveProject(request, response, next) {
	try {
		response.json({ data: await projectService.archive(request.params.projectId, request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function restoreProject(request, response, next) {
	try {
		response.json({ data: await projectService.restore(request.params.projectId, request.profileId) });
	} catch (error) {
		next(error);
	}
}
