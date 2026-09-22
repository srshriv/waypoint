import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { environmentRepository } from "../environments/environment.repository.js";
import { projectRepository } from "../projects/project.repository.js";
import { releaseService } from "../releases/release.service.js";
import { createSteps } from "./deployment-steps.js";
import { deploymentLogRepository, deploymentRepository } from "./deployment.repository.js";
import { jobRepository } from "./job.repository.js";

const projectNotFound = () => new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");
const environmentNotFound = () => new AppError(404, "ENVIRONMENT_NOT_FOUND", "The requested environment does not exist.");
const deploymentNotFound = () => new AppError(404, "DEPLOYMENT_NOT_FOUND", "The requested deployment does not exist.");

const LOCK_LEASE_MS = 10_000;

async function loadOwnedProject(projectId, ownerId, { mutating = false } = {}) {
	if (!mongoose.isValidObjectId(projectId)) throw projectNotFound();
	const project = await projectRepository.findById(projectId, ownerId);
	if (!project) throw projectNotFound();
	if (mutating && project.archivedAt) throw new AppError(409, "PROJECT_ARCHIVED", "Restore this project before deploying to it.");
	return project;
}

async function loadEnvironment(environmentId, projectId) {
	if (!mongoose.isValidObjectId(environmentId)) throw environmentNotFound();
	const environment = await environmentRepository.findById(environmentId, projectId);
	if (!environment) throw environmentNotFound();
	return environment;
}

function requireReleaseManager(profile, action) {
	if (profile.role !== "releaseManager") {
		throw new AppError(403, "ROLE_FORBIDDEN", `Only a release manager can ${action}.`, {
			requiredRoles: ["releaseManager"],
			role: profile.role,
		});
	}
}

/**
 * Holds the environment lock across the read-and-write that a promotion or rollback performs,
 * so two of them cannot both read the same live release and both queue work. The holder token
 * is deliberately not the new deployment's id: the worker locks with that id later, and the
 * same-holder clause on claimLock would otherwise let the worker take the lock while this
 * trigger still holds it, and let this trigger's release drop the worker's lock.
 */
async function withEnvironmentLock(environment, run) {
	const token = new mongoose.Types.ObjectId();
	const claimed = await environmentRepository.claimLock(environment._id, token, new Date(Date.now() + LOCK_LEASE_MS));
	if (!claimed) {
		const current = await environmentRepository.findById(environment._id);
		throw new AppError(409, "ENVIRONMENT_LOCKED", `${environment.name} is busy with another deployment.`, {
			environmentId: String(environment._id),
			environmentName: environment.name,
			lockedByDeploymentId: current?.lockedByDeploymentId ? String(current.lockedByDeploymentId) : null,
			lockedAt: current?.lockedAt || null,
			leaseExpiresAt: current?.leaseExpiresAt || null,
		});
	}
	try {
		return await run();
	} finally {
		await environmentRepository.releaseLock(environment._id, token);
	}
}

/** Shared tail of every trigger: idempotency on requestKey, then the deployment and its job. */
async function queueDeployment({ project, environment, kind, releaseId, previousReleaseId, requestKey, profile, queuedMessage }) {
	const existing = await deploymentRepository.findByRequestKey(requestKey);
	if (existing) return { deployment: existing, reused: true };

	let deployment;
	try {
		deployment = await deploymentRepository.create({
			projectId: project._id,
			environmentId: environment._id,
			releaseId,
			previousReleaseId,
			kind,
			status: "queued",
			steps: createSteps(),
			requestKey,
			triggeredBy: profile.profileId,
			queuedAt: new Date(),
			finishedAt: null,
		});
	} catch (error) {
		if (error?.code === 11000) {
			const raced = await deploymentRepository.findByRequestKey(requestKey);
			if (raced) return { deployment: raced, reused: true };
		}
		throw error;
	}

	await jobRepository.create({ kind: "deployment", deploymentId: deployment._id, status: "pending", nextRunAt: new Date() });
	await deploymentLogRepository.append(deployment._id, [{ level: "info", message: queuedMessage }]);
	return { deployment: deployment.toObject(), reused: false };
}

export const deploymentService = {
	async list(projectId, environmentId, ownerId) {
		await loadOwnedProject(projectId, ownerId);
		if (environmentId && !mongoose.isValidObjectId(environmentId)) throw environmentNotFound();
		return deploymentRepository.listByProject(projectId, environmentId);
	},

	async get(projectId, deploymentId, ownerId) {
		await loadOwnedProject(projectId, ownerId);
		if (!mongoose.isValidObjectId(deploymentId)) throw deploymentNotFound();
		const deployment = await deploymentRepository.findById(deploymentId, projectId);
		if (!deployment) throw deploymentNotFound();
		return deployment;
	},

	async logs(projectId, deploymentId, after, ownerId) {
		const deployment = await deploymentService.get(projectId, deploymentId, ownerId);
		const lines = await deploymentLogRepository.listAfter(deployment._id, after);
		return { lines, cursor: lines.length ? lines[lines.length - 1].sequence : after };
	},

	/**
	 * Queues one deployment and its background job. `requestKey` makes this idempotent: the
	 * unique index rejects a repeat, the 11000 is caught, and the original deployment comes
	 * back so an accidental double submit cannot start a second run.
	 */
	async rollbackTargets(projectId, environmentId, ownerId) {
		await loadOwnedProject(projectId, ownerId);
		const environment = await loadEnvironment(environmentId, projectId);
		const targets = await deploymentRepository.listRollbackTargets(environment._id);
		return targets.map((target) => ({
			...target,
			isCurrent: String(environment.currentDeploymentId || "") === String(target._id),
		}));
	},

	async trigger(projectId, { environmentId, releaseId, requestKey }, profile) {
		await loadOwnedProject(projectId, profile.profileId, { mutating: true });
		if (!mongoose.isValidObjectId(environmentId)) throw environmentNotFound();
		const environment = await environmentRepository.findById(environmentId, projectId);
		if (!environment) throw environmentNotFound();

		// Contributors may deploy to the first stage only. Anything further along the promotion
		// order is a release-manager decision, so this lives here rather than in route
		// middleware: it depends on the environment's rank, not on the route alone.
		if (environment.rank > 0 && profile.role !== "releaseManager") {
			throw new AppError(403, "ROLE_FORBIDDEN", "Only a release manager can deploy beyond the first stage.", {
				requiredRoles: ["releaseManager"],
				role: profile.role,
				environmentRank: environment.rank,
			});
		}

		// The release must already exist in this project. Deployments never invent one.
		const release = await releaseService.requireInProject(releaseId, projectId);

		return queueDeployment({
			project: { _id: projectId },
			environment,
			kind: "deploy",
			releaseId: release._id,
			previousReleaseId: environment.currentReleaseId || null,
			requestKey,
			profile,
			queuedMessage: `Deployment of ${release.version} queued for ${environment.name} by ${profile.name}.`,
		});
	},

	/**
	 * Advances the release currently live on the source environment to the next rank. The
	 * release is read from the source and snapshotted onto the deployment here, at trigger
	 * time, so what the release manager approved is what ships even if the source changes
	 * while the job waits in the queue.
	 */
	async promote(projectId, { sourceEnvironmentId, targetEnvironmentId, requestKey }, profile) {
		const project = await loadOwnedProject(projectId, profile.profileId, { mutating: true });
		requireReleaseManager(profile, "promote a release");

		const source = await loadEnvironment(sourceEnvironmentId, projectId);
		const target = await loadEnvironment(targetEnvironmentId, projectId);
		if (String(source._id) === String(target._id)) {
			throw new AppError(400, "PROMOTION_SAME_ENVIRONMENT", "A release cannot be promoted onto the environment it already occupies.");
		}
		// Exactly one rank. Refusing a skip beats guessing whether an intermediate stage was
		// meant to be run or skipped.
		if (target.rank !== source.rank + 1) {
			throw new AppError(
				400,
				"PROMOTION_RANK_SKIP",
				`A promotion moves a release exactly one rank up. ${source.name} is rank ${source.rank}, so it can only promote to rank ${source.rank + 1}, not ${target.name} at rank ${target.rank}.`,
				{
					sourceRank: source.rank,
					targetRank: target.rank,
					requiredTargetRank: source.rank + 1,
				},
			);
		}

		return withEnvironmentLock(target, async () => {
			const live = await environmentRepository.findById(source._id, projectId);
			if (!live.currentReleaseId || !live.currentDeploymentId) {
				throw new AppError(409, "NOTHING_TO_PROMOTE", `${source.name} has no live release to promote.`, {
					sourceEnvironmentId: String(source._id),
				});
			}
			const sourceDeployment = await deploymentRepository.findById(live.currentDeploymentId, projectId);
			if (!sourceDeployment || sourceDeployment.status !== "live") {
				throw new AppError(409, "NOTHING_TO_PROMOTE", `${source.name} has no successfully deployed release to promote.`);
			}
			// The target's health-check requirement is satisfied by evidence from the source:
			// the release must have completed its verification step there.
			if (target.requiresHealthCheck) {
				const verify = sourceDeployment.steps.find((step) => step.key === "verify");
				if (!verify || verify.status !== "succeeded") {
					throw new AppError(
						409,
						"HEALTH_CHECK_NOT_PASSED",
						`${target.name} requires a passing health check, and the release on ${source.name} has not verified successfully.`,
						{
							sourceEnvironmentId: String(source._id),
							sourceDeploymentId: String(sourceDeployment._id),
							verifyStatus: verify ? verify.status : "missing",
						},
					);
				}
			}

			return queueDeployment({
				project,
				environment: target,
				kind: "promote",
				releaseId: live.currentReleaseId,
				previousReleaseId: target.currentReleaseId || null,
				requestKey,
				profile,
				queuedMessage: `Promotion queued: release from ${source.name} (rank ${source.rank}) to ${target.name} (rank ${target.rank}) by ${profile.name}.`,
			});
		});
	},

	/**
	 * Returns an environment to an earlier deployment that actually went live on it.
	 * Deliberately not gated on health checks: rollback is the recovery path, and a gate here
	 * could strand someone on a broken release.
	 */
	async rollback(projectId, { environmentId, targetDeploymentId, requestKey }, profile) {
		const project = await loadOwnedProject(projectId, profile.profileId, { mutating: true });
		requireReleaseManager(profile, "roll back a release");
		const environment = await loadEnvironment(environmentId, projectId);

		return withEnvironmentLock(environment, async () => {
			if (!mongoose.isValidObjectId(targetDeploymentId)) throw deploymentNotFound();
			const target = await deploymentRepository.findById(targetDeploymentId, projectId);
			if (!target || String(target.environmentId) !== String(environment._id)) throw deploymentNotFound();
			if (!["live", "superseded"].includes(target.status)) {
				throw new AppError(409, "ROLLBACK_TARGET_INVALID", "Only a deployment that went live can be rolled back to.", {
					targetStatus: target.status,
				});
			}
			const current = await environmentRepository.findById(environment._id, projectId);
			// Refusing beats a silent no-op: doing nothing would hide the mistake.
			if (String(current.currentDeploymentId || "") === String(target._id)) {
				throw new AppError(409, "ROLLBACK_TARGET_ALREADY_LIVE", `That deployment is already live on ${environment.name}.`, {
					targetDeploymentId: String(target._id),
					environmentId: String(environment._id),
				});
			}

			return queueDeployment({
				project,
				environment,
				kind: "rollback",
				releaseId: target.releaseId,
				previousReleaseId: current.currentReleaseId || null,
				requestKey,
				profile,
				queuedMessage: `Rollback queued: ${environment.name} returning to the release from deployment ${String(target._id).slice(-8)} by ${profile.name}.`,
			});
		});
	},
};
