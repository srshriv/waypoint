const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
let sessionToken = localStorage.getItem("waypoint-session-token") || "";
let profileToken = localStorage.getItem("waypoint-profile-token") || "";

export function setSessionToken(token) {
	sessionToken = token || "";
	if (sessionToken) localStorage.setItem("waypoint-session-token", sessionToken);
	else localStorage.removeItem("waypoint-session-token");
}

export function setProfileToken(token) {
	profileToken = token || "";
	if (profileToken) localStorage.setItem("waypoint-profile-token", profileToken);
	else localStorage.removeItem("waypoint-profile-token");
}

export const hasSessionToken = () => Boolean(sessionToken || profileToken);
export const hasProfileToken = () => Boolean(profileToken);

export async function request(path, options = {}) {
	const response = await fetch(`${baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(profileToken || sessionToken ? { Authorization: `Bearer ${profileToken || sessionToken}` } : {}),
			...options.headers,
		},
	});
	if (response.status === 204) return null;
	const contentType = response.headers?.get?.("content-type") || "";
	const payload = contentType.includes("application/json") || !response.headers ? await response.json() : null;
	if (!response.ok) {
		const code = payload?.error?.code;
		const message = payload?.error?.message || `Waypoint service returned ${response.status}.`;
		if (response.status === 401 && ["AUTH_REQUIRED", "INVALID_TOKEN", "ACCOUNT_UNAVAILABLE"].includes(code)) {
			setProfileToken();
			setSessionToken();
			localStorage.removeItem("waypoint-profile-id");
			window.dispatchEvent(new CustomEvent("waypoint-session-expired", { detail: message }));
		}
		// Carry the code and details through so a caller can say something specific, such as
		// naming the deployment holding an environment lock.
		const error = new Error(message);
		error.code = code || "";
		error.details = payload?.error?.details || null;
		error.status = response.status;
		throw error;
	}
	if (!payload || !("data" in payload)) throw new Error("Waypoint service returned an invalid response.");
	return payload.data;
}
