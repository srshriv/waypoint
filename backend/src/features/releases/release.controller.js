import { z } from "zod";
import { CHANGE_TYPES } from "./release.model.js";
import { releaseService } from "./release.service.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Provide a valid release id.");

const createSchema = z
	.object({
		version: z.string().trim().min(1).max(40),
		commitSha: z
			.string()
			.trim()
			.toLowerCase()
			.regex(/^[0-9a-f]{7,40}$/, "Provide a 7 to 40 character commit sha."),
		commitMessage: z.string().trim().min(1).max(300),
		author: z.string().trim().min(1).max(120),
		changes: z
			.array(
				z
					.object({
						path: z.string().trim().min(1).max(300),
						changeType: z.enum(CHANGE_TYPES),
					})
					.strict(),
			)
			.min(1)
			.max(200),
	})
	.strict();

const diffSchema = z.object({ from: objectId, to: objectId }).strict();

export async function listReleases(request, response, next) {
	try {
		response.json({ data: await releaseService.list(request.params.projectId, request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function createRelease(request, response, next) {
	try {
		response
			.status(201)
			.json({ data: await releaseService.create(request.params.projectId, createSchema.parse(request.body), request.profileId) });
	} catch (error) {
		next(error);
	}
}

export async function diffReleases(request, response, next) {
	try {
		const { from, to } = diffSchema.parse(request.query);
		response.json({ data: await releaseService.diff(request.params.projectId, from, to, request.profileId) });
	} catch (error) {
		next(error);
	}
}
