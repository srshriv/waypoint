import { Deployment } from "../deployments/deployment.model.js";
import { Environment } from "../environments/environment.model.js";
import { Member } from "../members/member.model.js";
import { Project } from "../projects/project.model.js";
import { Release } from "../releases/release.model.js";

/**
 * The dashboard owns no collection of its own. Like the reference insight repository, it reads
 * other features' models directly and keeps the cross-collection queries in one place rather
 * than spreading aggregation pipelines through the service.
 *
 * Everything is scoped to the acting profile's active projects: archived projects are not
 * operational, so they do not belong in a view about what is running right now.
 */
export const dashboardRepository = {
	listActiveProjects: (ownerId) => Project.find({ ownerId, archivedAt: null }, { name: 1, slug: 1 }).sort({ name: 1 }).lean(),

	countArchivedProjects: (ownerId) => Project.countDocuments({ ownerId, archivedAt: { $ne: null } }),

	listEnvironments: (projectIds) =>
		Environment.find({ projectId: { $in: projectIds } })
			.sort({ rank: 1, name: 1 })
			.lean(),

	countReleases: (projectIds) => Release.countDocuments({ projectId: { $in: projectIds } }),

	listRecentDeployments: (projectIds, limit) =>
		Deployment.find({ projectId: { $in: projectIds } })
			.sort({ queuedAt: -1 })
			.limit(limit)
			.lean(),

	listActiveDeployments: (projectIds) =>
		Deployment.find({ projectId: { $in: projectIds }, status: { $in: ["queued", "building", "deploying"] } })
			.sort({ queuedAt: 1 })
			.lean(),

	countDeployments: (projectIds, extra = {}) => Deployment.countDocuments({ projectId: { $in: projectIds }, ...extra }),

	/** Finished outcomes inside a window, used for the success rate. */
	outcomesSince: (projectIds, since) =>
		Deployment.aggregate([
			{ $match: { projectId: { $in: projectIds }, finishedAt: { $gte: since }, status: { $in: ["live", "failed", "superseded"] } } },
			{ $group: { _id: "$status", count: { $sum: 1 } } },
		]),

	findReleases: (releaseIds) => Release.find({ _id: { $in: releaseIds } }, { version: 1, commitSha: 1 }).lean(),

	findMembers: (memberIds) => Member.find({ _id: { $in: memberIds } }, { name: 1, avatarColor: 1, role: 1 }).lean(),
};
