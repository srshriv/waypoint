import { request } from "../../shared/api/client.js";

export const environmentApi = {
	list: (projectId) => request(`/projects/${projectId}/environments`),
	create: (projectId, input) => request(`/projects/${projectId}/environments`, { method: "POST", body: JSON.stringify(input) }),
	update: (projectId, environmentId, input) =>
		request(`/projects/${projectId}/environments/${environmentId}`, { method: "PATCH", body: JSON.stringify(input) }),
	reorder: (projectId, environmentIds) =>
		request(`/projects/${projectId}/environments/reorder`, { method: "POST", body: JSON.stringify({ environmentIds }) }),
};
