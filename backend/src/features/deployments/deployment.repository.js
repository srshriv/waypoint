import { Deployment } from "./deployment.model.js";
import { DeploymentLog } from "./deployment-log.model.js";

export const deploymentRepository = {
	create: (input) => Deployment.create(input),
	findById: (id, projectId) => Deployment.findOne({ _id: id, ...(projectId ? { projectId } : {}) }).lean(),
	findByRequestKey: (requestKey) => Deployment.findOne({ requestKey }).lean(),
	listByProject: (projectId, environmentId, limit = 25) =>
		Deployment.find({ projectId, ...(environmentId ? { environmentId } : {}) })
			.sort({ queuedAt: -1 })
			.limit(limit)
			.lean(),
	/** Deployments that successfully put a release on this environment, newest first. These
	 *  are the only valid rollback targets: a failed attempt never went live. */
	listRollbackTargets: (environmentId, limit = 25) =>
		Deployment.find({ environmentId, status: { $in: ["live", "superseded"] } })
			.sort({ finishedAt: -1 })
			.limit(limit)
			.lean(),
	update: (id, input) => Deployment.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean(),
	/** A deployment that was replaced rather than broken. Only a currently live one moves. */
	supersede: (id) => Deployment.findOneAndUpdate({ _id: id, status: "live" }, { $set: { status: "superseded" } }, { new: true }).lean(),
	setStatus: (id, status, extra = {}) =>
		Deployment.findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true, runValidators: true }).lean(),
	setSteps: (id, steps, extra = {}) =>
		Deployment.findByIdAndUpdate(id, { $set: { steps, ...extra } }, { new: true, runValidators: true }).lean(),
};

export const deploymentLogRepository = {
	/** Cursor read: only lines newer than the sequence the console already holds. */
	listAfter: (deploymentId, after = 0, limit = 400) =>
		DeploymentLog.find({ deploymentId, sequence: { $gt: after } })
			.sort({ sequence: 1 })
			.limit(limit)
			.lean(),
	lastSequence: async (deploymentId) => {
		const last = await DeploymentLog.findOne({ deploymentId }).sort({ sequence: -1 }).select({ sequence: 1 }).lean();
		return last ? last.sequence : 0;
	},
	async append(deploymentId, lines) {
		if (!lines.length) return [];
		const base = await deploymentLogRepository.lastSequence(deploymentId);
		return DeploymentLog.insertMany(
			lines.map((line, index) => ({
				deploymentId,
				sequence: base + index + 1,
				level: line.level || "info",
				message: line.message,
				stepKey: line.stepKey || "",
				createdAt: new Date(),
			})),
		);
	},
};
