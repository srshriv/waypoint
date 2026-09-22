/**
 * The console navigation is the capability map for Waypoint. Every entry is backed end to end
 * by a real backend feature; nothing here advertises something the product cannot do.
 */
export const CONSOLE_SECTIONS = [
	{
		key: "dashboard",
		label: "Dashboard",
		icon: "insights",
		title: "Operations dashboard",
		summary: "What is live where, recent deployment activity across every project, and the health of the background worker queue.",
	},
	{
		key: "projects",
		label: "Projects",
		icon: "layers",
		title: "Projects",
		summary: "Organize work into projects, each owning its own development, staging, and production environments.",
	},
	{
		key: "environments",
		label: "Environments",
		icon: "terminal",
		title: "Environments",
		summary: "Per-project environments with their current release, health-check state, and promotion lock.",
	},
	{
		key: "deployments",
		label: "Deployments",
		icon: "rocket_launch",
		title: "Deployments",
		summary:
			"Queue a deployment as a background job and watch the worker build, roll out, and verify it with a live log. Promote the live release one rank at a time, or roll an environment back to an earlier release.",
	},
	{
		key: "releases",
		label: "Releases",
		icon: "history",
		title: "Releases",
		summary: "Every build cut for a project, with its commit and changed files, and a diff between any two releases.",
	},
	{
		key: "variables",
		label: "Variables",
		icon: "key",
		title: "Variables and secrets",
		summary:
			"Environment variables and secrets managed per environment, with secret values masked by the API before they reach the browser.",
	},
	{
		key: "access",
		label: "Access",
		icon: "shield_person",
		title: "Roles and access",
		summary: "Who is in the workspace and what each role may do, with every rule enforced by the API.",
	},
];

export const DEFAULT_SECTION = "dashboard";

export const findSection = (key) => CONSOLE_SECTIONS.find((section) => section.key === key) || CONSOLE_SECTIONS[0];
