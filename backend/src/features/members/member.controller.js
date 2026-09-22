import { memberService } from "./member.service.js";

export async function listProfiles(request, response, next) {
    try { response.json({ data: await memberService.listProfiles(request.account?.allowedProfileIds) }); } catch (error) { next(error); }
}
