import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { projectRepository } from "../projects/project.repository.js";
import { environmentRepository } from "./environment.repository.js";

const MAX_ENVIRONMENTS = 21;

const projectNotFound = () => new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
const notFound = () => new AppError(404, "ENVIRONMENT_NOT_FOUND", "The requested environment does not exist.");

function duplicateConflict(error) {
    if (error?.code !== 11000) return null;
    if (error.keyPattern?.rank) return new AppError(409, "ENVIRONMENT_RANK_CONFLICT", "Another environment already holds that promotion rank.");
    return new AppError(409, "ENVIRONMENT_NAME_CONFLICT", "An environment with this name already exists in this project.");
}

async function loadOwnedProject(projectId, ownerId, { mutating = false } = {}) {
    if (!mongoose.isValidObjectId(projectId)) throw projectNotFound();
    const project = await projectRepository.findById(projectId, ownerId);
    if (!project) throw projectNotFound();
    if (mutating && project.archivedAt) throw new AppError(409, "PROJECT_ARCHIVED", "Restore this project before changing its environments.");
    return project;
}

async function ensureAvailable(projectId, { name, rank }, excludedId) {
    if (name && await environmentRepository.findByName(projectId, name, excludedId)) {
        throw new AppError(409, "ENVIRONMENT_NAME_CONFLICT", "An environment with this name already exists in this project.");
    }
    if (rank !== undefined && await environmentRepository.findByRank(projectId, rank, excludedId)) {
        throw new AppError(409, "ENVIRONMENT_RANK_CONFLICT", "Another environment already holds that promotion rank.");
    }
}

export const environmentService = {
    async list(projectId, ownerId) {
        await loadOwnedProject(projectId, ownerId);
        return environmentRepository.listByProject(projectId);
    },

    async create(projectId, input, ownerId) {
        await loadOwnedProject(projectId, ownerId, { mutating: true });
        const count = await environmentRepository.countByProject(projectId);
        if (count >= MAX_ENVIRONMENTS) {
            throw new AppError(409, "ENVIRONMENT_LIMIT", `A project can hold at most ${MAX_ENVIRONMENTS} environments.`, { limit: MAX_ENVIRONMENTS });
        }
        const highest = await environmentRepository.highestRank(projectId);
        const rank = input.rank ?? (highest ? highest.rank + 1 : 0);
        if (rank > 20) throw new AppError(409, "ENVIRONMENT_RANK_CONFLICT", "Promotion rank must be between 0 and 20.");
        await ensureAvailable(projectId, { name: input.name, rank });
        try {
            return await environmentRepository.create({
                projectId,
                name: input.name,
                rank,
                requiresHealthCheck: input.requiresHealthCheck,
                currentReleaseId: null,
                currentDeploymentId: null,
                lockedByDeploymentId: null,
                lockedAt: null,
                leaseExpiresAt: null,
            });
        } catch (error) { throw duplicateConflict(error) || error; }
    },

    async update(projectId, environmentId, input, ownerId) {
        await loadOwnedProject(projectId, ownerId, { mutating: true });
        if (!mongoose.isValidObjectId(environmentId)) throw notFound();
        if (!await environmentRepository.findById(environmentId, projectId)) throw notFound();
        await ensureAvailable(projectId, input, environmentId);
        let environment;
        try { environment = await environmentRepository.update(environmentId, projectId, input); }
        catch (error) { throw duplicateConflict(error) || error; }
        if (!environment) throw notFound();
        return environment;
    },

    async reorder(projectId, environmentIds, ownerId) {
        await loadOwnedProject(projectId, ownerId, { mutating: true });
        if (environmentIds.some((id) => !mongoose.isValidObjectId(id))) throw notFound();
        const existing = await environmentRepository.listByProject(projectId);
        const existingIds = existing.map((environment) => String(environment._id)).sort();
        const requestedIds = environmentIds.map(String);
        if (new Set(requestedIds).size !== requestedIds.length) {
            throw new AppError(400, "ENVIRONMENT_ORDER_INVALID", "List each environment exactly once.");
        }
        if (requestedIds.length !== existingIds.length || [...requestedIds].sort().some((id, index) => id !== existingIds[index])) {
            throw new AppError(400, "ENVIRONMENT_ORDER_INVALID", "The new order must list every environment in this project exactly once.");
        }
        return environmentRepository.applyRankOrder(projectId, requestedIds);
    },
};
