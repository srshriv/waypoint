import { environmentRepository } from "../environments/environment.repository.js";
import {
    DEPLOYMENT_STEPS,
    failureLogLines,
    shouldFailTransiently,
    startLogLines,
    stepLogLines,
    successLogLines,
    transientFailureFor,
} from "./deployment-steps.js";
import { TERMINAL_STATUSES } from "./deployment.model.js";
import { deploymentLogRepository, deploymentRepository } from "./deployment.repository.js";
import { jobRepository } from "./job.repository.js";

const POLL_INTERVAL_MS = 400;
const LEASE_MS = 15_000;
const BACKOFF_BASE_MS = 1200;
const BACKOFF_MAX_MS = 20_000;

// Identifies this process's claims. A restart produces a new id, so the previous worker's
// in-flight job is reclaimed through its expired lease rather than left stranded.
const workerId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let timer = null;
let stopped = true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const leaseUntil = () => new Date(Date.now() + LEASE_MS);
const backoffFor = (attempts) => Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

async function runSteps(deployment, environment, job) {
    const steps = deployment.steps.map((step) => ({ ...step }));
    for (const definition of DEPLOYMENT_STEPS) {
        const step = steps.find((candidate) => candidate.key === definition.key);
        if (!step || step.status === "succeeded") continue;

        step.status = "running";
        step.attempts += 1;
        step.startedAt = step.startedAt || new Date();
        step.detail = "";
        await deploymentRepository.setSteps(deployment._id, steps, { status: definition.phase });
        await deploymentLogRepository.append(deployment._id, [{ level: "info", message: `→ ${definition.name}`, stepKey: step.key }]);

        await sleep(definition.durationMs);

        // Keep both leases alive across a long step: the job lease so no other worker steals
        // the job, and the environment lease so the lock is not treated as abandoned. The
        // same-holder clause on claimLock is what makes re-claiming our own lock an extension.
        await jobRepository.heartbeat(job._id, workerId, leaseUntil());
        await environmentRepository.claimLock(environment._id, deployment._id, leaseUntil());

        if (shouldFailTransiently(step.key, job.attempts)) {
            const error = transientFailureFor(step);
            step.status = "failed";
            step.finishedAt = new Date();
            step.detail = error.message;
            await deploymentRepository.setSteps(deployment._id, steps);
            error.step = step;
            throw error;
        }

        await deploymentLogRepository.append(deployment._id, stepLogLines(step, { attempt: job.attempts, environment, deployment }));
        step.status = "succeeded";
        step.finishedAt = new Date();
        await deploymentRepository.setSteps(deployment._id, steps);
    }
    return steps;
}

async function processJob(job) {
    const deployment = await deploymentRepository.findById(job.deploymentId);
    if (!deployment || TERMINAL_STATUSES.includes(deployment.status)) {
        await jobRepository.succeed(job._id, workerId);
        return;
    }
    const environment = await environmentRepository.findById(deployment.environmentId);
    if (!environment) {
        await deploymentRepository.setStatus(deployment._id, "failed", { finishedAt: new Date() });
        await deploymentLogRepository.append(deployment._id, [{ level: "error", message: "The target environment no longer exists." }]);
        await jobRepository.fail(job._id, workerId, "Environment missing");
        return;
    }

    // One deployment at a time per environment. Losing the race is not an error: the job goes
    // back on the queue with backoff and tries again once the holder releases.
    const locked = await environmentRepository.claimLock(environment._id, deployment._id, leaseUntil());
    if (!locked) {
        const nextRunAt = new Date(Date.now() + backoffFor(job.attempts));
        await deploymentLogRepository.append(deployment._id, [
            { level: "warn", message: `${environment.name} is busy with another deployment. Waiting for the lock.` },
        ]);
        await jobRepository.retryAt(job._id, workerId, nextRunAt, "Environment locked");
        return;
    }

    try {
        await deploymentLogRepository.append(deployment._id, startLogLines(deployment, environment, job.attempts));
        await runSteps(deployment, environment, job);
        const replacedDeploymentId = environment.currentDeploymentId;
        await deploymentRepository.setStatus(deployment._id, "live", { finishedAt: new Date() });
        await environmentRepository.update(environment._id, environment.projectId, {
            currentReleaseId: deployment.releaseId,
            currentDeploymentId: deployment._id,
        });
        await deploymentLogRepository.append(deployment._id, successLogLines(deployment, environment));
        // Whatever was live here has been replaced, not broken, so it becomes superseded.
        if (replacedDeploymentId && String(replacedDeploymentId) !== String(deployment._id)) {
            const replaced = await deploymentRepository.supersede(replacedDeploymentId);
            if (replaced) {
                await deploymentLogRepository.append(deployment._id, [
                    { level: "info", message: `Deployment ${String(replacedDeploymentId).slice(-8)} is now superseded; it was replaced, not failed.` },
                ]);
            }
        }
        await jobRepository.succeed(job._id, workerId);
    } catch (error) {
        const willRetry = Boolean(error.transient) && job.attempts < job.maxAttempts;
        const nextRunAt = new Date(Date.now() + backoffFor(job.attempts));
        await deploymentLogRepository.append(deployment._id, failureLogLines(error.step || { key: "", name: "Step" }, error, { willRetry, nextRunAt }));
        if (willRetry) {
            await deploymentRepository.setStatus(deployment._id, "queued");
            await jobRepository.retryAt(job._id, workerId, nextRunAt, error.message);
        } else {
            await deploymentRepository.setStatus(deployment._id, "failed", { finishedAt: new Date() });
            await jobRepository.fail(job._id, workerId, error.message);
        }
    } finally {
        await environmentRepository.releaseLock(environment._id, deployment._id);
    }
}

async function runOnce() {
    const job = await jobRepository.claim(workerId, leaseUntil());
    if (!job) return false;
    await processJob(job);
    return true;
}

async function tick() {
    if (stopped) return;
    let worked = false;
    try { worked = await runOnce(); }
    catch (error) { console.error(`Deployment worker error: ${error.message}`); }
    if (!stopped) timer = setTimeout(tick, worked ? 0 : POLL_INTERVAL_MS);
}

export function startDeploymentWorker() {
    if (!stopped) return workerId;
    stopped = false;
    console.log(`Deployment worker ${workerId} started (lease ${LEASE_MS}ms)`);
    timer = setTimeout(tick, 0);
    return workerId;
}

export function stopDeploymentWorker() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
}
