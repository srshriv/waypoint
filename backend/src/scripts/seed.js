import dotenv from "dotenv";

dotenv.config({ quiet: true });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { WorkspaceAccount } from "../features/auth/workspace-account.model.js";
import { Deployment } from "../features/deployments/deployment.model.js";
import { DeploymentLog } from "../features/deployments/deployment-log.model.js";
import { Job } from "../features/deployments/job.model.js";
import { Environment } from "../features/environments/environment.model.js";
import { Member } from "../features/members/member.model.js";
import { Project } from "../features/projects/project.model.js";
import { Release } from "../features/releases/release.model.js";
import { Variable } from "../features/variables/variable.model.js";
import { loadConfig } from "../shared/config/index.js";
import { demoColorFor } from "../shared/constants/demo-colors.js";
import { buildDeploymentHistory } from "./deployment-seed-data.js";
import { RELEASE_VERSIONS, changesFor, commitShaFor, projectReleaseData } from "./release-seed-data.js";
import { variablesFor } from "./variable-seed-data.js";

const config = loadConfig();

const DEMO_PASSWORD = "password123";
const PASSWORD_ROUNDS = 12;

const memberRows = [
	{ name: "Avery Chen", email: "avery.chen@waypoint.dev", role: "releaseManager", title: "Staff Platform Engineer", sortOrder: 1 },
	{ name: "Marcus Hale", email: "marcus.hale@waypoint.dev", role: "releaseManager", title: "Engineering Manager", sortOrder: 2 },
	{ name: "Priya Raman", email: "priya.raman@waypoint.dev", role: "contributor", title: "Backend Engineer", sortOrder: 3 },
	{ name: "Devon Brooks", email: "devon.brooks@waypoint.dev", role: "contributor", title: "Frontend Engineer", sortOrder: 4 },
	{ name: "Sofia Marino", email: "sofia.marino@waypoint.dev", role: "contributor", title: "Site Reliability Engineer", sortOrder: 5 },
];

const projectRows = [
	{
		owner: "avery.chen@waypoint.dev",
		name: "Checkout API",
		slug: "checkout-api",
		description: "Cart, order placement, and payment intent orchestration for the storefront.",
	},
	{
		owner: "avery.chen@waypoint.dev",
		name: "Payments Gateway",
		slug: "payments-gateway",
		description: "Processor adapters, retry handling, and settlement reconciliation.",
	},
	{
		owner: "avery.chen@waypoint.dev",
		name: "Legacy Billing Sync",
		slug: "legacy-billing-sync",
		description: "Nightly export to the retired billing mainframe. Superseded by Payments Gateway.",
		archivedDaysAgo: 34,
	},
	{
		owner: "marcus.hale@waypoint.dev",
		name: "Identity Service",
		slug: "identity-service",
		description: "Sign-in, session issuance, and workspace membership for every product surface.",
	},
	{
		owner: "marcus.hale@waypoint.dev",
		name: "Notification Hub",
		slug: "notification-hub",
		description: "Transactional email, push, and in-app delivery with per-channel throttling.",
	},
	{
		owner: "priya.raman@waypoint.dev",
		name: "Inventory Service",
		slug: "inventory-service",
		description: "Stock levels, warehouse reservations, and backorder projections.",
	},
	{
		owner: "priya.raman@waypoint.dev",
		name: "Search Indexer",
		slug: "search-indexer",
		description: "Incremental catalog indexing pipeline with nightly full rebuilds.",
	},
	{
		owner: "devon.brooks@waypoint.dev",
		name: "Storefront Web",
		slug: "storefront-web",
		description: "Customer-facing React storefront, server-rendered product and category pages.",
	},
	{
		owner: "devon.brooks@waypoint.dev",
		name: "Design System",
		slug: "design-system",
		description: "Shared component library, design tokens, and accessibility primitives.",
	},
	{
		owner: "sofia.marino@waypoint.dev",
		name: "Edge Router",
		slug: "edge-router",
		description: "TLS termination, request routing, and regional failover at the edge.",
	},
	{
		owner: "sofia.marino@waypoint.dev",
		name: "Observability Stack",
		slug: "observability-stack",
		description: "Metrics, traces, and log aggregation shared by every Waypoint service.",
	},
];

// Promotion order is the rank: a build moves development -> staging -> production. Only the
// environments that face users gate promotion on a health check.
const environmentRows = [
	{ name: "Development", rank: 0, requiresHealthCheck: false },
	{ name: "Staging", rank: 1, requiresHealthCheck: true },
	{ name: "Production", rank: 2, requiresHealthCheck: true },
];

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function clearDatabase() {
	console.log("Clearing existing collections...");
	// Deployment history is seeded rather than left empty, so the console has something to show
	// on first open. A restart therefore restores that baseline history, discarding anything
	// created since.
	await Promise.all([
		Member.deleteMany({}),
		WorkspaceAccount.deleteMany({}),
		Project.deleteMany({}),
		Environment.deleteMany({}),
		Deployment.deleteMany({}),
		DeploymentLog.deleteMany({}),
		Job.deleteMany({}),
		Release.deleteMany({}),
		Variable.deleteMany({}),
	]);
	await Promise.all([
		Member.syncIndexes(),
		WorkspaceAccount.syncIndexes(),
		Project.syncIndexes(),
		Environment.syncIndexes(),
		Deployment.syncIndexes(),
		DeploymentLog.syncIndexes(),
		Job.syncIndexes(),
		Release.syncIndexes(),
		Variable.syncIndexes(),
	]);
}

async function seedMembers() {
	console.log("\nSeeding workspace members...");
	const members = await Member.create(memberRows.map((row) => ({ ...row, avatarColor: demoColorFor(row.email), isProfile: true })));
	const managers = members.filter((member) => member.role === "releaseManager").length;
	console.log(`  Created ${members.length} members (${managers} release managers, ${members.length - managers} contributors)`);
	return members;
}

async function seedAccounts(members) {
	console.log("\nSeeding sign-in accounts...");
	const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_ROUNDS);
	const allowedProfileIds = members.map((member) => member._id);
	const accounts = await WorkspaceAccount.create(
		members.map((member) => ({
			name: member.name,
			email: member.email,
			passwordHash,
			allowedProfileIds,
		})),
	);
	console.log(`  Created ${accounts.length} accounts, each able to open any of the ${members.length} profiles`);
	return accounts;
}

async function seedProjects(members) {
	console.log("\nSeeding projects...");
	const memberByEmail = new Map(members.map((member) => [member.email, member]));
	const projects = await Project.insertMany(
		projectRows.map((row) => ({
			ownerId: memberByEmail.get(row.owner)._id,
			name: row.name,
			slug: row.slug,
			description: row.description,
			repositoryUrl: `https://github.com/waypoint-labs/${row.slug}`,
			archivedAt: row.archivedDaysAgo ? daysAgo(row.archivedDaysAgo) : null,
		})),
	);
	const archived = projects.filter((project) => project.archivedAt).length;
	console.log(
		`  Created ${projects.length} projects (${projects.length - archived} active, ${archived} archived) across ${memberByEmail.size} owners`,
	);
	return projects;
}

async function seedEnvironments(projects) {
	console.log("\nSeeding environments...");
	const environments = await Environment.insertMany(
		projects.flatMap((project) =>
			environmentRows.map((row) => ({
				projectId: project._id,
				name: row.name,
				rank: row.rank,
				requiresHealthCheck: row.requiresHealthCheck,
				currentReleaseId: null,
				currentDeploymentId: null,
				lockedByDeploymentId: null,
				lockedAt: null,
				leaseExpiresAt: null,
			})),
		),
	);
	console.log(`  Created ${environments.length} environments (${environmentRows.length} per project across ${projects.length} projects)`);
	return environments;
}

async function seedVariables(projects, environments) {
	console.log("\nSeeding environment variables...");
	const projectById = new Map(projects.map((project) => [String(project._id), project]));
	const rows = environments.flatMap((environment) => {
		const project = projectById.get(String(environment.projectId));
		return variablesFor(project, environment).map((row) => ({ environmentId: environment._id, ...row }));
	});
	const variables = await Variable.insertMany(rows);
	const secrets = variables.filter((variable) => variable.isSecret).length;
	console.log(
		`  Created ${variables.length} variables across ${environments.length} environments (${secrets} secrets, ${variables.length - secrets} plain)`,
	);
	return variables;
}

async function seedReleases(projects, members) {
	console.log("\nSeeding releases...");
	const memberById = new Map(members.map((member) => [String(member._id), member]));
	const rows = [];
	projects.forEach((project, projectIndex) => {
		const blueprint = projectReleaseData[project.slug];
		if (!blueprint) return;
		const author = memberById.get(String(project.ownerId));
		blueprint.messages.forEach((message, index) => {
			// Distinct, ordered timestamps: a diff range is defined by createdAt, so two
			// releases must never share one.
			const createdAt = daysAgo(90 - projectIndex - index * 9);
			rows.push({
				projectId: project._id,
				version: RELEASE_VERSIONS[index],
				commitSha: commitShaFor(project.slug, RELEASE_VERSIONS[index]),
				commitMessage: message,
				author: author ? author.name : "Waypoint CI",
				changes: changesFor(project.slug, blueprint.paths, index),
				createdAt,
				updatedAt: createdAt,
			});
		});
	});
	// timestamps disabled so the explicit createdAt above is what lands.
	const releases = await Release.insertMany(rows, { timestamps: false });
	const changeCount = releases.reduce((total, release) => total + release.changes.length, 0);
	console.log(
		`  Created ${releases.length} releases across ${new Set(releases.map((r) => String(r.projectId))).size} projects (${changeCount} file changes)`,
	);
	return releases;
}

async function seedDeploymentHistory(projects, environments, releases, members) {
	console.log("\nSeeding deployment history...");
	const environmentsByProject = new Map();
	for (const environment of environments) {
		const key = String(environment.projectId);
		if (!environmentsByProject.has(key)) environmentsByProject.set(key, []);
		environmentsByProject.get(key).push(environment);
	}
	const releasesByProject = new Map();
	// Oldest first, so release index 0 is the first build a project ever cut.
	for (const release of [...releases].sort((a, b) => a.createdAt - b.createdAt)) {
		const key = String(release.projectId);
		if (!releasesByProject.has(key)) releasesByProject.set(key, []);
		releasesByProject.get(key).push(release);
	}
	const memberById = new Map(members.map((member) => [String(member._id), member]));

	const { deployments, logs, jobs, environmentState } = buildDeploymentHistory({
		projects,
		environmentsByProject,
		releasesByProject,
		memberById,
	});

	await Deployment.insertMany(deployments, { timestamps: false });
	await DeploymentLog.insertMany(logs);
	await Job.insertMany(jobs, { timestamps: false });
	await Promise.all(
		[...environmentState.entries()].map(([environmentId, state]) => Environment.updateOne({ _id: environmentId }, { $set: state })),
	);

	const byStatus = deployments.reduce(
		(totals, deployment) => ({ ...totals, [deployment.status]: (totals[deployment.status] || 0) + 1 }),
		{},
	);
	console.log(
		`  Created ${deployments.length} deployments (${byStatus.live || 0} live, ${byStatus.superseded || 0} superseded, ${byStatus.failed || 0} failed)`,
	);
	console.log(`  Wrote ${logs.length} log lines and ${jobs.length} completed jobs`);
	console.log(`  ${environmentState.size} of ${environments.length} environments now hold a release`);
}

async function seed() {
	await mongoose.connect(config.mongodbUri);
	console.log(`Connected to MongoDB at ${config.mongodbUri}`);
	await clearDatabase();
	const members = await seedMembers();
	await seedAccounts(members);
	const projects = await seedProjects(members);
	const environments = await seedEnvironments(projects);
	await seedVariables(projects, environments);
	const releases = await seedReleases(projects, members);
	await seedDeploymentHistory(projects, environments, releases, members);
	console.log("\nWaypoint seed complete.");
	console.log(`  Sign in with any member email and the password ${DEMO_PASSWORD}`);
	await mongoose.disconnect();
}

try {
	await seed();
} catch (error) {
	console.error(`Seed failed: ${error.message}`);
	await mongoose.disconnect();
	process.exit(1);
}
