import mongoose from "mongoose";
import { AppError } from "../errors/app-error.js";
import { memberService } from "../../features/members/member.service.js";

export async function resolveProfileContext(request, response, next) {
	try {
		const profileId = request.auth?.profileId || "";
		if (!profileId) throw new AppError(401, "PROFILE_REQUIRED", "Select a Waypoint profile to continue.");
		if (!mongoose.isValidObjectId(profileId)) throw new AppError(401, "INVALID_PROFILE", "Select a valid Waypoint profile.");
		if (!request.account.allowedProfileIds.some((id) => String(id) === String(profileId))) {
			throw new AppError(403, "PROFILE_FORBIDDEN", "This profile is not available in the current workspace.");
		}
		const profile = await memberService.findProfileById(profileId);
		if (!profile) throw new AppError(401, "PROFILE_NOT_FOUND", "This Waypoint profile is no longer available.");
		request.profileId = String(profile._id);
		request.profile = profile;
		next();
	} catch (error) {
		next(error);
	}
}
