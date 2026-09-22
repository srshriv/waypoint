import { request } from "../../shared/api/client.js";

export const deploymentApi = {
    list: (projectId, environmentId) => request(`/projects/${projectId}/deployments${environmentId ? `?environmentId=${environmentId}` : ""}`),
    get: (projectId, deploymentId) => request(`/projects/${projectId}/deployments/${deploymentId}`),
    logs: (projectId, deploymentId, after = 0) => request(`/projects/${projectId}/deployments/${deploymentId}/logs?after=${after}`),
    trigger: (projectId, environmentId, releaseId, requestKey) => request(`/projects/${projectId}/deployments`, {
        method: "POST",
        body: JSON.stringify({ environmentId, releaseId, requestKey }),
    }),
    rollbackTargets: (projectId, environmentId) => request(`/projects/${projectId}/deployments/rollback-targets?environmentId=${environmentId}`),
    promote: (projectId, sourceEnvironmentId, targetEnvironmentId, requestKey) => request(`/projects/${projectId}/deployments/promote`, {
        method: "POST",
        body: JSON.stringify({ sourceEnvironmentId, targetEnvironmentId, requestKey }),
    }),
    rollback: (projectId, environmentId, targetDeploymentId, requestKey) => request(`/projects/${projectId}/deployments/rollback`, {
        method: "POST",
        body: JSON.stringify({ environmentId, targetDeploymentId, requestKey }),
    }),
};
