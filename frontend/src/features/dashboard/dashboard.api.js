import { request } from "../../shared/api/client.js";

export const dashboardApi = {
	overview: () => request("/dashboard"),
};
