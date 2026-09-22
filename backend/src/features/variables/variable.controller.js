import { z } from "zod";
import { VARIABLE_KEY_PATTERN } from "./variable.model.js";
import { variableService } from "./variable.service.js";

const key = z.string().trim().toUpperCase().min(1).max(100)
    .regex(VARIABLE_KEY_PATTERN, "Use uppercase letters, digits and underscores, starting with a letter.");
const value = z.string().min(1).max(4000);

const createSchema = z.object({ key, value, isSecret: z.boolean().default(false) }).strict();
const updateSchema = z
    .object({ key: key.optional(), value: value.optional(), isSecret: z.boolean().optional() })
    .strict()
    .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update.");

export async function listVariables(request, response, next) {
    try {
        response.json({ data: await variableService.list(request.params.projectId, request.params.environmentId, request.profileId) });
    } catch (error) { next(error); }
}

export async function createVariable(request, response, next) {
    try {
        const input = createSchema.parse(request.body);
        response.status(201).json({ data: await variableService.create(request.params.projectId, request.params.environmentId, input, request.profileId) });
    } catch (error) { next(error); }
}

export async function updateVariable(request, response, next) {
    try {
        const input = updateSchema.parse(request.body);
        response.json({ data: await variableService.update(request.params.projectId, request.params.environmentId, request.params.variableId, input, request.profileId) });
    } catch (error) { next(error); }
}

export async function deleteVariable(request, response, next) {
    try {
        await variableService.remove(request.params.projectId, request.params.environmentId, request.params.variableId, request.profileId);
        response.status(204).send();
    } catch (error) { next(error); }
}

export async function revealVariable(request, response, next) {
    try {
        response.json({ data: await variableService.reveal(request.params.projectId, request.params.environmentId, request.params.variableId, request.profileId) });
    } catch (error) { next(error); }
}
