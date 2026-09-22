import { request } from "../../shared/api/client.js";

const base = (projectId, environmentId) => `/projects/${projectId}/environments/${environmentId}/variables`;

export const variableApi = {
    list: (projectId, environmentId) => request(base(projectId, environmentId)),
    create: (projectId, environmentId, input) => request(base(projectId, environmentId), { method: "POST", body: JSON.stringify(input) }),
    update: (projectId, environmentId, variableId, input) => request(`${base(projectId, environmentId)}/${variableId}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (projectId, environmentId, variableId) => request(`${base(projectId, environmentId)}/${variableId}`, { method: "DELETE" }),
    reveal: (projectId, environmentId, variableId) => request(`${base(projectId, environmentId)}/${variableId}/reveal`, { method: "POST" }),
};
