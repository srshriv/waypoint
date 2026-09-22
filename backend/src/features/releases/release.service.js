import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { projectRepository } from "../projects/project.repository.js";
import { releaseRepository } from "./release.repository.js";

const projectNotFound = () => new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
const releaseNotFound = () => new AppError(404, "RELEASE_NOT_FOUND", "The requested release does not exist.");

async function loadOwnedProject(projectId, ownerId, { mutating = false } = {}) {
    if (!mongoose.isValidObjectId(projectId)) throw projectNotFound();
    const project = await projectRepository.findById(projectId, ownerId);
    if (!project) throw projectNotFound();
    if (mutating && project.archivedAt) throw new AppError(409, "PROJECT_ARCHIVED", "Restore this project before cutting a release.");
    return project;
}

async function loadRelease(releaseId, projectId) {
    if (!mongoose.isValidObjectId(releaseId)) throw releaseNotFound();
    const release = await releaseRepository.findById(releaseId, projectId);
    if (!release) throw releaseNotFound();
    return release;
}

const summarize = (release) => ({
    _id: String(release._id),
    version: release.version,
    commitSha: release.commitSha,
    commitMessage: release.commitMessage,
    author: release.author,
    createdAt: release.createdAt,
    changeCount: release.changes.length,
});

/**
 * Collapses every change made across a range of releases into one entry per path. The net type
 * answers "what happened to this file between these two points": a file added and then edited
 * still reads as added, and anything whose last change was a removal reads as removed.
 */
function collapseChanges(releases) {
    const byPath = new Map();
    for (const release of releases) {
        for (const change of release.changes) {
            const entry = byPath.get(change.path) || { path: change.path, firstType: change.changeType, touchedBy: [] };
            entry.lastType = change.changeType;
            entry.touchedBy.push({ releaseId: String(release._id), version: release.version, changeType: change.changeType });
            byPath.set(change.path, entry);
        }
    }
    return [...byPath.values()]
        .map(({ path, firstType, lastType, touchedBy }) => ({
            path,
            netChangeType: lastType === "removed" ? "removed" : firstType === "added" ? "added" : "modified",
            touchedBy,
        }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

export const releaseService = {
    async list(projectId, ownerId) {
        await loadOwnedProject(projectId, ownerId);
        return releaseRepository.listByProject(projectId);
    },

    async create(projectId, input, ownerId) {
        await loadOwnedProject(projectId, ownerId, { mutating: true });
        if (await releaseRepository.findByVersion(projectId, input.version)) {
            throw new AppError(409, "RELEASE_VERSION_CONFLICT", `Release ${input.version} already exists in this project.`);
        }
        const paths = input.changes.map((change) => change.path);
        if (new Set(paths).size !== paths.length) {
            throw new AppError(400, "RELEASE_DUPLICATE_PATH", "List each changed path once.");
        }
        try {
            const release = await releaseRepository.create({ projectId, ...input });
            return release.toObject();
        } catch (error) {
            if (error?.code === 11000) throw new AppError(409, "RELEASE_VERSION_CONFLICT", `Release ${input.version} already exists in this project.`);
            throw error;
        }
    },

    async diff(projectId, fromId, toId, ownerId) {
        await loadOwnedProject(projectId, ownerId);
        if (String(fromId) === String(toId)) {
            throw new AppError(400, "DIFF_SAME_RELEASE", "Pick two different releases to compare.");
        }
        const [a, b] = await Promise.all([loadRelease(fromId, projectId), loadRelease(toId, projectId)]);
        // Comparison is directionless: the earlier release is always the baseline.
        const [from, to] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
        const range = await releaseRepository.listBetween(projectId, from.createdAt, to.createdAt);
        const files = collapseChanges(range);
        return {
            from: summarize(from),
            to: summarize(to),
            reversed: a.createdAt > b.createdAt,
            releases: range.map(summarize),
            files,
            summary: {
                releaseCount: range.length,
                fileCount: files.length,
                added: files.filter((file) => file.netChangeType === "added").length,
                modified: files.filter((file) => file.netChangeType === "modified").length,
                removed: files.filter((file) => file.netChangeType === "removed").length,
            },
        };
    },

    /** Used by deployments to confirm a release exists in the project before queueing work. */
    requireInProject: (releaseId, projectId) => loadRelease(releaseId, projectId),
};
