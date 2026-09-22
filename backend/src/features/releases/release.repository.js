import { Release } from "./release.model.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const releaseRepository = {
	listByProject: (projectId, limit = 100) => Release.find({ projectId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
	findById: (id, projectId) => Release.findOne({ _id: id, ...(projectId ? { projectId } : {}) }).lean(),
	findByVersion: (projectId, version) =>
		Release.findOne({
			projectId,
			version: { $regex: `^${escapeRegex(version)}$`, $options: "i" },
		}).lean(),
	/** Releases cut after `from` and up to and including `to`, oldest first. */
	listBetween: (projectId, from, to) =>
		Release.find({ projectId, createdAt: { $gt: from, $lte: to } })
			.sort({ createdAt: 1, _id: 1 })
			.lean(),
	countByProject: (projectId) => Release.countDocuments({ projectId }),
	create: (input) => Release.create(input),
};
