import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { environmentRepository } from "../environments/environment.repository.js";
import { projectRepository } from "../projects/project.repository.js";
import { variableRepository } from "./variable.repository.js";

const MAX_VARIABLES = 100;

const projectNotFound = () => new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
const environmentNotFound = () => new AppError(404, "ENVIRONMENT_NOT_FOUND", "The requested environment does not exist.");
const variableNotFound = () => new AppError(404, "VARIABLE_NOT_FOUND", "The requested variable does not exist.");

/**
 * Masking happens here, on the server, so a secret's real value never crosses the wire on a
 * list. The preview keeps the last four characters once a value is long enough to spare them,
 * which is enough to tell two keys apart without disclosing anything usable.
 */
const previewOf = (value = "") => (value.length >= 12 ? `${"•".repeat(8)}${value.slice(-4)}` : "•".repeat(8));

const toPublic = (variable) => {
    const base = {
        _id: String(variable._id),
        environmentId: String(variable.environmentId),
        key: variable.key,
        isSecret: Boolean(variable.isSecret),
        valueLength: (variable.value || "").length,
        createdAt: variable.createdAt,
        updatedAt: variable.updatedAt,
    };
    if (variable.isSecret) return { ...base, value: null, preview: previewOf(variable.value) };
    return { ...base, value: variable.value, preview: variable.value };
};

async function loadOwnedEnvironment(projectId, environmentId, ownerId, { mutating = false } = {}) {
    if (!mongoose.isValidObjectId(projectId)) throw projectNotFound();
    const project = await projectRepository.findById(projectId, ownerId);
    if (!project) throw projectNotFound();
    if (mutating && project.archivedAt) throw new AppError(409, "PROJECT_ARCHIVED", "Restore this project before changing its variables.");
    if (!mongoose.isValidObjectId(environmentId)) throw environmentNotFound();
    const environment = await environmentRepository.findById(environmentId, projectId);
    if (!environment) throw environmentNotFound();
    return environment;
}

async function ensureKeyFree(environmentId, key, excludedId) {
    if (key && await variableRepository.findByKey(environmentId, key, excludedId)) {
        throw new AppError(409, "VARIABLE_KEY_CONFLICT", `${key} is already set on this environment.`);
    }
}

const duplicateConflict = (error, key) => (error?.code === 11000
    ? new AppError(409, "VARIABLE_KEY_CONFLICT", `${key} is already set on this environment.`)
    : null);

export const variableService = {
    async list(projectId, environmentId, ownerId) {
        const environment = await loadOwnedEnvironment(projectId, environmentId, ownerId);
        const variables = await variableRepository.listByEnvironment(environment._id);
        return variables.map(toPublic);
    },

    async create(projectId, environmentId, input, ownerId) {
        const environment = await loadOwnedEnvironment(projectId, environmentId, ownerId, { mutating: true });
        const count = await variableRepository.countByEnvironment(environment._id);
        if (count >= MAX_VARIABLES) {
            throw new AppError(409, "VARIABLE_LIMIT", `An environment can hold at most ${MAX_VARIABLES} variables.`, { limit: MAX_VARIABLES });
        }
        await ensureKeyFree(environment._id, input.key);
        try {
            const created = await variableRepository.create({ environmentId: environment._id, ...input });
            return toPublic({ ...created.toObject(), value: input.value });
        } catch (error) { throw duplicateConflict(error, input.key) || error; }
    },

    async update(projectId, environmentId, variableId, input, ownerId) {
        const environment = await loadOwnedEnvironment(projectId, environmentId, ownerId, { mutating: true });
        if (!mongoose.isValidObjectId(variableId)) throw variableNotFound();
        if (!await variableRepository.findById(variableId, environment._id)) throw variableNotFound();
        await ensureKeyFree(environment._id, input.key, variableId);
        let updated;
        try { updated = await variableRepository.update(variableId, environment._id, input); }
        catch (error) { throw duplicateConflict(error, input.key) || error; }
        if (!updated) throw variableNotFound();
        return toPublic(updated);
    },

    async remove(projectId, environmentId, variableId, ownerId) {
        const environment = await loadOwnedEnvironment(projectId, environmentId, ownerId, { mutating: true });
        if (!mongoose.isValidObjectId(variableId)) throw variableNotFound();
        const removed = await variableRepository.remove(variableId, environment._id);
        if (!removed) throw variableNotFound();
    },

    /**
     * The one path that returns a secret in the clear. Kept separate from the list so
     * disclosing a value is always an explicit, separately authorized request.
     */
    async reveal(projectId, environmentId, variableId, ownerId) {
        const environment = await loadOwnedEnvironment(projectId, environmentId, ownerId);
        if (!mongoose.isValidObjectId(variableId)) throw variableNotFound();
        const variable = await variableRepository.findByIdWithValue(variableId, environment._id);
        if (!variable) throw variableNotFound();
        return { _id: String(variable._id), key: variable.key, isSecret: Boolean(variable.isSecret), value: variable.value };
    },
};
