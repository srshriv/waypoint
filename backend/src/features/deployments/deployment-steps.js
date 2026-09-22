/**
 * Everything a deployment "does" is generated here, locally and deterministically. There is no
 * outbound network call: the worker walks these steps, emits their log lines, and sleeps for
 * the step duration. The push step fails on its first attempt on purpose so the retry and
 * backoff path is visible on every deployment rather than only under contrived conditions.
 */

export const DEPLOYMENT_STEPS = [
	{ key: "checkout", name: "Check out commit", phase: "building", durationMs: 380 },
	{ key: "build", name: "Build container image", phase: "building", durationMs: 620 },
	{ key: "push", name: "Push image to registry", phase: "building", durationMs: 480 },
	{ key: "rollout", name: "Roll out to instances", phase: "deploying", durationMs: 600 },
	{ key: "verify", name: "Verify instances are serving", phase: "deploying", durationMs: 420 },
];

const FLAKY_STEP_KEY = "push";
const FLAKY_UNTIL_ATTEMPT = 1;

export class TransientStepError extends Error {
	constructor(message) {
		super(message);
		this.name = "TransientStepError";
		this.transient = true;
	}
}

/** The seeded failure: the push step fails while this is the job's first attempt. */
export const shouldFailTransiently = (stepKey, attempt) => stepKey === FLAKY_STEP_KEY && attempt <= FLAKY_UNTIL_ATTEMPT;

export const createSteps = () =>
	DEPLOYMENT_STEPS.map((step) => ({
		key: step.key,
		name: step.name,
		status: "pending",
		attempts: 0,
		startedAt: null,
		finishedAt: null,
		detail: "",
	}));

const shortId = (value) => String(value).slice(-8);

const KIND_LABELS = { deploy: "Deployment", promote: "Promotion", rollback: "Rollback" };

export function startLogLines(deployment, environment, attempt) {
	const label = KIND_LABELS[deployment.kind] || "Deployment";
	const lines = [
		{ level: "info", message: `Waypoint worker picked up ${label.toLowerCase()} ${shortId(deployment._id)} (attempt ${attempt}).` },
		{ level: "info", message: `Target environment: ${environment.name} (promotion rank ${environment.rank}).` },
		{
			level: "info",
			message: `Release ${shortId(deployment.releaseId)}${deployment.previousReleaseId ? ` replacing ${shortId(deployment.previousReleaseId)}` : " (first release on this environment)"}.`,
		},
	];
	if (deployment.kind === "rollback") {
		lines.push({ level: "warn", message: "Rollback: restoring a previously live release. Health-check gating does not apply." });
	}
	if (attempt > 1) lines.push({ level: "warn", message: `Resuming after a failed attempt. Completed steps are skipped.` });
	return lines;
}

export function stepLogLines(step, { attempt, environment, deployment }) {
	const release = shortId(deployment.releaseId);
	const byKey = {
		checkout: [`Fetching source for release ${release}.`, `Checked out commit ${release} on branch main.`],
		build: [
			`Building image waypoint/${release}:${environment.name.toLowerCase()}.`,
			"Layer cache hit for dependencies; rebuilding application layer.",
			"Image built in 0.6s.",
		],
		push: [`Pushing waypoint/${release} to registry.`],
		rollout: [`Rolling out to ${environment.name} instances.`, "Instance 1 of 2 replaced.", "Instance 2 of 2 replaced."],
		verify: [
			"Waiting for instances to report ready.",
			environment.requiresHealthCheck
				? "Health check required on this environment; probing /healthz."
				: "No health check required on this environment; checking process liveness only.",
			"All instances are serving.",
		],
	};
	return (byKey[step.key] || [`${step.name} complete.`]).map((message) => ({ level: "info", message, stepKey: step.key }));
}

export const failureLogLines = (step, error, { willRetry, nextRunAt }) => [
	{ level: "error", message: `${step.name} failed: ${error.message}`, stepKey: step.key },
	willRetry
		? { level: "warn", message: `Retrying in ${Math.round((nextRunAt - Date.now()) / 100) / 10}s.`, stepKey: step.key }
		: { level: "error", message: "No attempts remaining. Marking this deployment failed.", stepKey: step.key },
];

export const successLogLines = (deployment, environment) => [
	{ level: "info", message: `Release ${shortId(deployment.releaseId)} is live on ${environment.name}.` },
];

export const transientFailureFor = (step) => new TransientStepError(`registry returned 503 while pushing ${step.key} layers`);
