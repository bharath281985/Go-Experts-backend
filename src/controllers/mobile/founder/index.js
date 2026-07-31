export * as analyticsController from '../../../modules/mobile/founder/controllers/analytics.controller.js';
export * as businessPlanController from '../../../modules/mobile/founder/controllers/business-plan.controller.js';
export * as dashboardController from '../../../modules/mobile/founder/controllers/dashboard.controller.js';
export * as documentsController from '../../../modules/mobile/founder/controllers/documents.controller.js';
export * as fundingController from '../../../modules/mobile/founder/controllers/funding.controller.js';
export * as investorRequestsController from '../../../modules/mobile/founder/controllers/investor-requests.controller.js';
export * as investorsController from '../../../modules/mobile/founder/controllers/investors.controller.js';
export * as invoicesController from '../../../modules/mobile/founder/controllers/invoices.controller.js';
export * as meetingsController from '../../../modules/mobile/founder/controllers/meetings.controller.js';
export * as messagesController from '../../../modules/mobile/founder/controllers/messages.controller.js';
export * as pitchDeckController from '../../../modules/mobile/founder/controllers/pitch-deck.controller.js';
export * as profileController from '../../../modules/mobile/founder/controllers/profile.controller.js';
export * as reportsController from '../../../modules/mobile/founder/controllers/reports.controller.js';
export * as searchController from '../../../modules/mobile/founder/controllers/search.controller.js';
export * as settingsController from '../../../modules/mobile/founder/controllers/settings.controller.js';
export * as subscriptionsController from '../../../modules/mobile/founder/controllers/subscriptions.controller.js';
export * as teamController from '../../../modules/mobile/founder/controllers/team.controller.js';
export * as walletController from '../../../modules/mobile/founder/controllers/wallet.controller.js';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
export const getStartupById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const profile = await prisma.founderProfile.findUnique({
            where: { userId },
            include: { user: { select: { email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true } } }
        });
        if (!profile) {
            return res.status(404).json(errorResponse('Startup profile not found', 'NOT_FOUND'));
        }
        return res.json(successResponse('Startup details retrieved', profile));
    }
    catch (error) {
        next(error);
    }
};
