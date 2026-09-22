import { AppError } from "../errors/app-error.js";
import { ROLE_LABELS } from "../constants/roles.js";

const describe = (roles) => roles.map((role) => (ROLE_LABELS[role] || role).toLowerCase()).join(" or ");

/**
 * Gates an action on the active profile's role. Runs after resolveProfileContext, which is
 * what puts the resolved profile on the request.
 */
export function requireRole(...roles) {
	return function enforceRole(request, response, next) {
		const role = request.profile?.role;
		if (!role) return next(new AppError(401, "PROFILE_REQUIRED", "Select a Waypoint profile to continue."));
		if (!roles.includes(role)) {
			return next(
				new AppError(403, "ROLE_FORBIDDEN", `Only a ${describe(roles)} can perform this action.`, { requiredRoles: roles, role }),
			);
		}
		return next();
	};
}
