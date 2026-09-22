import { jobRepository } from "../deployments/job.repository.js";
import { dashboardRepository } from "./dashboard.repository.js";

const ACTIVITY_LIMIT = 12;
const SUCCESS_WINDOW_DAYS = 7;

const startOfToday = () => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Queue health comes straight from jobRepository, the way the reference calendar service reads
 * the event repository. The queue is process-wide rather than per project, so it is reported as
 * the worker's state, not the profile's.
 */
async function queueHealth() {
	const [byStatus, retried, oldest] = await Promise.all([
		jobRepository.countByStatus(),
		jobRepository.countRetried(),
		jobRepository.oldestPending(),
	]);
	const counts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
	return {
		pending: counts.pending || 0,
		running: counts.running || 0,
		succeeded: counts.succeeded || 0,
		failed: counts.failed || 0,
		retried,
		oldestPendingAt: oldest?.nextRunAt || null,
	};
}

function successRateFrom(outcomes) {
	const counts = Object.fromEntries(outcomes.map((row) => [row._id, row.count]));
	// A superseded deployment succeeded and was later replaced, so it counts as a success.
	const succeeded = (counts.live || 0) + (counts.superseded || 0);
	const failed = counts.failed || 0;
	const sample = succeeded + failed;
	if (!sample) return null;
	return { rate: Math.round((succeeded / sample) * 100), sample, failed, windowDays: SUCCESS_WINDOW_DAYS };
}

export const dashboardService = {
	async overview(profileId) {
		const [projects, archivedProjects] = await Promise.all([
			dashboardRepository.listActiveProjects(profileId),
			dashboardRepository.countArchivedProjects(profileId),
		]);
		const projectIds = projects.map((project) => project._id);
		const projectById = new Map(projects.map((project) => [String(project._id), project]));

		if (!projectIds.length) {
			return {
				counts: {
					projects: 0,
					archivedProjects,
					environments: 0,
					environmentsWithRelease: 0,
					releases: 0,
					deploymentsToday: 0,
					deploymentsTotal: 0,
					successRate: null,
				},
				queue: await queueHealth(),
				environments: [],
				activity: [],
			};
		}

		const [environments, releases, recent, active, deploymentsTotal, deploymentsToday, outcomes, queue] = await Promise.all([
			dashboardRepository.listEnvironments(projectIds),
			dashboardRepository.countReleases(projectIds),
			dashboardRepository.listRecentDeployments(projectIds, ACTIVITY_LIMIT),
			dashboardRepository.listActiveDeployments(projectIds),
			dashboardRepository.countDeployments(projectIds),
			dashboardRepository.countDeployments(projectIds, { queuedAt: { $gte: startOfToday() } }),
			dashboardRepository.outcomesSince(projectIds, daysAgo(SUCCESS_WINDOW_DAYS)),
			queueHealth(),
		]);

		// One lookup pass for the names the rows need, rather than a query per row.
		const releaseIds = [
			...new Set(
				[
					...environments.map((environment) => environment.currentReleaseId).filter(Boolean),
					...recent.map((deployment) => deployment.releaseId).filter(Boolean),
				].map(String),
			),
		];
		const memberIds = [...new Set(recent.map((deployment) => String(deployment.triggeredBy)).filter(Boolean))];
		const [releaseRows, memberRows] = await Promise.all([
			dashboardRepository.findReleases(releaseIds),
			dashboardRepository.findMembers(memberIds),
		]);
		const releaseById = new Map(releaseRows.map((release) => [String(release._id), release]));
		const memberById = new Map(memberRows.map((member) => [String(member._id), member]));
		const activeByEnvironment = new Map(active.map((deployment) => [String(deployment.environmentId), deployment]));

		const summarizeRelease = (id) => {
			const release = id ? releaseById.get(String(id)) : null;
			return release ? { _id: String(release._id), version: release.version, commitSha: release.commitSha } : null;
		};

		const environmentRows = environments.map((environment) => {
			const project = projectById.get(String(environment.projectId));
			const inFlight = activeByEnvironment.get(String(environment._id)) || null;
			return {
				_id: String(environment._id),
				name: environment.name,
				rank: environment.rank,
				requiresHealthCheck: environment.requiresHealthCheck,
				project: { _id: String(environment.projectId), name: project?.name || "Project" },
				release: summarizeRelease(environment.currentReleaseId),
				activeDeployment: inFlight ? { _id: String(inFlight._id), kind: inFlight.kind, status: inFlight.status } : null,
				locked: Boolean(environment.lockedByDeploymentId),
				lockedByDeploymentId: environment.lockedByDeploymentId ? String(environment.lockedByDeploymentId) : null,
				leaseExpiresAt: environment.leaseExpiresAt || null,
			};
		});

		const environmentNameById = new Map(environments.map((environment) => [String(environment._id), environment.name]));
		const activity = recent.map((deployment) => {
			const member = memberById.get(String(deployment.triggeredBy));
			return {
				_id: String(deployment._id),
				kind: deployment.kind,
				status: deployment.status,
				queuedAt: deployment.queuedAt,
				finishedAt: deployment.finishedAt,
				project: { _id: String(deployment.projectId), name: projectById.get(String(deployment.projectId))?.name || "Project" },
				environment: {
					_id: String(deployment.environmentId),
					name: environmentNameById.get(String(deployment.environmentId)) || "Environment",
				},
				release: summarizeRelease(deployment.releaseId),
				triggeredBy: member
					? { _id: String(member._id), name: member.name, avatarColor: member.avatarColor, role: member.role }
					: null,
			};
		});

		return {
			counts: {
				projects: projects.length,
				archivedProjects,
				environments: environments.length,
				environmentsWithRelease: environments.filter((environment) => environment.currentReleaseId).length,
				releases,
				deploymentsToday,
				deploymentsTotal,
				successRate: successRateFrom(outcomes),
			},
			queue,
			environments: environmentRows,
			activity,
		};
	},
};
