export const TERMINAL_STATUSES = ["live", "failed", "superseded"];

export const isRunning = (deployment) => Boolean(deployment) && !TERMINAL_STATUSES.includes(deployment.status);

export const STATUS_LABELS = {
    queued: "Queued",
    building: "Building",
    deploying: "Deploying",
    live: "Live",
    failed: "Failed",
    superseded: "Superseded",
};

export const KIND_LABELS = {
    deploy: "Deploy",
    promote: "Promotion",
    rollback: "Rollback",
};

export const STATUS_TONE = {
    queued: "neutral",
    building: "busy",
    deploying: "busy",
    live: "good",
    failed: "bad",
    superseded: "neutral",
};

export const STEP_ICON = {
    pending: "schedule",
    running: "sync",
    succeeded: "check_circle",
    failed: "error_outline",
};

export function elapsedLabel(deployment) {
    const start = new Date(deployment.queuedAt);
    const end = deployment.finishedAt ? new Date(deployment.finishedAt) : new Date();
    const seconds = Math.max(0, (end - start) / 1000);
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
