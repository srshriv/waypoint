import { request } from "../../shared/api/client.js";

export const releaseApi = {
    list: (projectId) => request(`/projects/${projectId}/releases`),
    create: (projectId, input) => request(`/projects/${projectId}/releases`, { method: "POST", body: JSON.stringify(input) }),
    diff: (projectId, from, to) => request(`/projects/${projectId}/releases/diff?from=${from}&to=${to}`),
};
