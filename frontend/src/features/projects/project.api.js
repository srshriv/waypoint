import { request } from "../../shared/api/client.js";

export const projectApi = {
	list: (status = "active") => request(`/projects?status=${encodeURIComponent(status)}`),
	create: (input) => request("/projects", { method: "POST", body: JSON.stringify(input) }),
	update: (projectId, input) => request(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(input) }),
	archive: (projectId) => request(`/projects/${projectId}/archive`, { method: "POST" }),
	restore: (projectId) => request(`/projects/${projectId}/restore`, { method: "POST" }),
};
