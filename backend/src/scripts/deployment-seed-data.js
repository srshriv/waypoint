import mongoose from "mongoose";
import {
    DEPLOYMENT_STEPS,
    failureLogLines,
    startLogLines,
    stepLogLines,
    successLogLines,
} from "../features/deployments/deployment-steps.js";

/**
 * Builds a deterministic deployment history so the console is populated on first open.
 *
 * History is described as an ordered list of events per project and then replayed, which is
 * what gives correct supersede semantics for free: whenever an event goes live on an
 * environment, whatever was live there before is marked superseded, exactly as the worker does.
 *
 * Every seeded deployment is in a terminal state and its job is terminal too, so the running
 * worker cannot pick any of this up and re-run it.
 */

const MAX_ATTEMPTS = 4;
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

// The real worker always fails the push step once and succeeds on the retry, so seeded
// successes carry the same two attempts rather than a tidier fiction.
const PUSH_KEY = "push";
const FAILING_STEP_KEY = "verify";
const FAILURE_REASON = "health check did not pass on 3 of 4 instances";

/**
 * Four shapes, so the fleet does not look uniform. A real estate of projects has some fully
 * promoted, some that never reached production, and some sitting on a failure, which also
 * means not every environment ends up holding a release.
 */
const SHAPES = [
    // Fully promoted and settled: development, staging and production all on the same release.
    (newest, previous, oldest) => [
        { kind: "deploy", rank: 0, release: oldest },
        { kind: "promote", rank: 1, release: oldest },
        { kind: "deploy", rank: 0, release: previous },
        { kind: "promote", rank: 1, release: previous },
        { kind: "promote", rank: 2, release: previous },
    ],
    // Fully promoted, but the newest build failed on the way in.
    (newest, previous, oldest) => [
        { kind: "deploy", rank: 0, release: oldest },
        { kind: "promote", rank: 1, release: oldest },
        { kind: "deploy", rank: 0, release: previous },
        { kind: "promote", rank: 1, release: previous },
        { kind: "promote", rank: 2, release: previous },
        { kind: "deploy", rank: 0, release: newest, outcome: "failed" },
    ],
    // Never promoted to production; development is a release ahead of staging.
    (newest, previous, oldest) => [
        { kind: "deploy", rank: 0, release: oldest },
        { kind: "promote", rank: 1, release: oldest },
        { kind: "deploy", rank: 0, release: previous },
        { kind: "promote", rank: 1, release: previous },
        { kind: "deploy", rank: 0, release: newest },
    ],
    // Early days: development only, with a failure that was retried successfully.
    (newest, previous) => [
        { kind: "deploy", rank: 0, release: previous },
        { kind: "deploy", rank: 0, release: newest, outcome: "failed" },
        { kind: "deploy", rank: 0, release: newest },
    ],
];

function eventsFor(projectIndex, releaseCount) {
    const newest = releaseCount - 1;
    const previous = Math.max(0, releaseCount - 2);
    const oldest = Math.max(0, releaseCount - 3);
    return SHAPES[projectIndex % SHAPES.length](newest, previous, oldest);
}

// The newest event of the first few projects is hours old so the dashboard has same-day
// activity; the rest trail off over days.
function eventTime(projectIndex, eventIndex, eventCount) {
    const tailHours = projectIndex < 3 ? 2 + projectIndex * 3 : 26 + projectIndex * 9;
    const spacingHours = 27 + (projectIndex % 3) * 5;
    return hoursAgo(tailHours + (eventCount - 1 - eventIndex) * spacingHours);
}

function stepsFor(outcome) {
    return DEPLOYMENT_STEPS.map((definition) => {
        const attempts = definition.key === PUSH_KEY ? 2 : 1;
        if (outcome === "failed" && definition.key === FAILING_STEP_KEY) {
            return { key: definition.key, name: definition.name, status: "failed", attempts: MAX_ATTEMPTS, startedAt: null, finishedAt: null, detail: FAILURE_REASON };
        }
        return { key: definition.key, name: definition.name, status: "succeeded", attempts, startedAt: null, finishedAt: null, detail: "" };
    });
}

/** Replays one deployment's log exactly as the worker would have written it. */
function logsFor(deployment, environment, memberName, outcome) {
    const lines = [{ level: "info", message: `${deployment.kind === "promote" ? "Promotion" : "Deployment"} of ${deployment.releaseVersion} queued for ${environment.name} by ${memberName}.` }];
    const attempts = outcome === "failed" ? MAX_ATTEMPTS : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        lines.push(...startLogLines(deployment, environment, attempt));
        for (const definition of DEPLOYMENT_STEPS) {
            // A retry resumes at the first step that has not succeeded.
            if (attempt > 1 && definition.key !== FAILING_STEP_KEY) continue;
            lines.push({ level: "info", message: `→ ${definition.name}`, stepKey: definition.key });

            if (outcome === "failed" && definition.key === FAILING_STEP_KEY) {
                const willRetry = attempt < MAX_ATTEMPTS;
                lines.push(...failureLogLines(
                    { key: definition.key, name: definition.name },
                    { message: FAILURE_REASON },
                    { willRetry, nextRunAt: Date.now() + 1200 * 2 ** (attempt - 1) },
                ));
                break;
            }
            if (attempt === 1 && definition.key === PUSH_KEY) {
                lines.push({ level: "error", message: `${definition.name} failed: registry returned 503 while pushing push layers`, stepKey: definition.key });
                lines.push({ level: "warn", message: "Retrying in 1.2s.", stepKey: definition.key });
                lines.push({ level: "info", message: `Waypoint worker picked up ${deployment.kind === "promote" ? "promotion" : "deployment"} ${String(deployment._id).slice(-8)} (attempt 2).`, stepKey: definition.key });
                lines.push({ level: "warn", message: "Resuming after a failed attempt. Completed steps are skipped.", stepKey: definition.key });
                lines.push({ level: "info", message: `→ ${definition.name}`, stepKey: definition.key });
            }
            lines.push(...stepLogLines({ key: definition.key, name: definition.name }, { attempt, environment, deployment }));
        }
        if (outcome !== "failed") lines.push(...successLogLines(deployment, environment));
    }
    return lines;
}

export function buildDeploymentHistory({ projects, environmentsByProject, releasesByProject, memberById }) {
    const deployments = [];
    const logs = [];
    const jobs = [];
    const environmentState = new Map();

    projects.forEach((project, projectIndex) => {
        const environments = environmentsByProject.get(String(project._id)) || [];
        const releases = releasesByProject.get(String(project._id)) || [];
        if (!environments.length || !releases.length) return;

        const member = memberById.get(String(project.ownerId));
        const events = eventsFor(projectIndex, releases.length);
        // Tracks what is live on each environment as the history replays.
        const live = new Map();

        events.forEach((event, eventIndex) => {
            const environment = environments.find((candidate) => candidate.rank === event.rank);
            const release = releases[event.release];
            if (!environment || !release) return;

            const outcome = event.outcome === "failed" ? "failed" : "live";
            const queuedAt = eventTime(projectIndex, eventIndex, events.length);
            const finishedAt = new Date(queuedAt.getTime() + (outcome === "failed" ? 21_000 : 4800));
            const previous = live.get(String(environment._id)) || null;
            const _id = new mongoose.Types.ObjectId();

            const deployment = {
                _id,
                projectId: project._id,
                environmentId: environment._id,
                releaseId: release._id,
                previousReleaseId: previous ? previous.releaseId : null,
                kind: event.kind,
                status: outcome,
                steps: stepsFor(outcome),
                requestKey: `seed-${project.slug}-${eventIndex}`,
                triggeredBy: project.ownerId,
                queuedAt,
                finishedAt,
                createdAt: queuedAt,
                updatedAt: finishedAt,
            };
            deployments.push(deployment);

            const lines = logsFor({ ...deployment, releaseVersion: release.version }, environment, member ? member.name : "Waypoint CI", outcome);
            lines.forEach((line, index) => logs.push({
                deploymentId: _id,
                sequence: index + 1,
                level: line.level || "info",
                message: line.message,
                stepKey: line.stepKey || "",
                createdAt: new Date(queuedAt.getTime() + index * 120),
            }));

            jobs.push({
                kind: "deployment",
                deploymentId: _id,
                // Terminal, so the running worker's claim query can never match these.
                status: outcome === "failed" ? "failed" : "succeeded",
                attempts: outcome === "failed" ? MAX_ATTEMPTS : 2,
                maxAttempts: MAX_ATTEMPTS,
                nextRunAt: queuedAt,
                leaseExpiresAt: null,
                lockedBy: null,
                lastError: outcome === "failed" ? FAILURE_REASON : "",
                createdAt: queuedAt,
                updatedAt: finishedAt,
            });

            if (outcome === "live") {
                // Whatever was live here has been replaced, not broken.
                if (previous) {
                    const replaced = deployments.find((candidate) => String(candidate._id) === String(previous.deploymentId));
                    if (replaced) replaced.status = "superseded";
                    logs.push({
                        deploymentId: _id,
                        sequence: lines.length + 1,
                        level: "info",
                        message: `Deployment ${String(previous.deploymentId).slice(-8)} is now superseded; it was replaced, not failed.`,
                        stepKey: "",
                        createdAt: new Date(queuedAt.getTime() + lines.length * 120),
                    });
                }
                live.set(String(environment._id), { deploymentId: _id, releaseId: release._id });
                environmentState.set(String(environment._id), { currentReleaseId: release._id, currentDeploymentId: _id });
            }
        });
    });

    return { deployments, logs, jobs, environmentState };
}
