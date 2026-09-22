import { Environment } from "./environment.model.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const environmentRepository = {
    listByProject: (projectId) => Environment.find({ projectId }).sort({ rank: 1 }).lean(),
    findById: (id, projectId) => Environment.findOne({ _id: id, ...(projectId ? { projectId } : {}) }).lean(),
    findByName: (projectId, name, excludedId) => Environment.findOne({
        projectId,
        name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
        ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).lean(),
    findByRank: (projectId, rank, excludedId) => Environment.findOne({
        projectId,
        rank,
        ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).lean(),
    highestRank: (projectId) => Environment.findOne({ projectId }).sort({ rank: -1 }).select({ rank: 1 }).lean(),
    countByProject: (projectId) => Environment.countDocuments({ projectId }),
    create: (input) => Environment.create(input),
    update: (id, projectId, input) => Environment.findOneAndUpdate({ _id: id, projectId }, input, { new: true, runValidators: true }).lean(),

    /**
     * Applies a new rank order in two passes because (projectId, rank) is unique: the first
     * pass parks every document on a negative rank that cannot collide with a final one, the
     * second pass writes 0..n-1.
     */
    async applyRankOrder(projectId, orderedIds) {
        await Environment.bulkWrite(orderedIds.map((id, index) => ({
            updateOne: { filter: { _id: id, projectId }, update: { $set: { rank: -(index + 1) } } },
        })));
        await Environment.bulkWrite(orderedIds.map((id, index) => ({
            updateOne: { filter: { _id: id, projectId }, update: { $set: { rank: index } } },
        })));
        return Environment.find({ projectId }).sort({ rank: 1 }).lean();
    },

    /**
     * Takes the promotion lock in one atomic step. Matches only when the lock is free, its
     * lease has expired, or this same deployment already holds it (so a retry is idempotent).
     * Returns null when a different deployment holds a live lease.
     */
    claimLock: (environmentId, deploymentId, leaseExpiresAt, now = new Date()) => Environment.findOneAndUpdate(
        {
            _id: environmentId,
            $or: [
                { lockedByDeploymentId: null },
                { leaseExpiresAt: { $lte: now } },
                { lockedByDeploymentId: deploymentId },
            ],
        },
        { $set: { lockedByDeploymentId: deploymentId, lockedAt: now, leaseExpiresAt } },
        { new: true },
    ).lean(),

    /**
     * Releases the promotion lock in one atomic step. Returns null when this deployment is
     * not the current lock holder, so a late worker cannot unlock someone else's work.
     */
    releaseLock: (environmentId, deploymentId) => Environment.findOneAndUpdate(
        { _id: environmentId, lockedByDeploymentId: deploymentId },
        { $set: { lockedByDeploymentId: null, lockedAt: null, leaseExpiresAt: null } },
        { new: true },
    ).lean(),
};
