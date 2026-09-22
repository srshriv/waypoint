import { dashboardService } from "./dashboard.service.js";

export async function getOverview(request, response, next) {
    try {
        response.json({ data: await dashboardService.overview(request.profileId) });
    } catch (error) {
        next(error);
    }
}
