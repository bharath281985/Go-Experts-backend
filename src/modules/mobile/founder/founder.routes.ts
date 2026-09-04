import { Router } from 'express';
import { getMyVerification, updateMyVerification, deleteMyVerification } from '../../../controllers/verification/verification.controller.js';
import { upload, chatUpload, handleUploadError } from '../../../middleware/upload.js';
import { authenticate, authorizeRole } from '../../../middlewares/auth.js';
import { rejectLocalFilePaths } from '../../../middlewares/reject-local-file-paths.middleware.js';

// Controllers
import { getDashboard } from './controllers/dashboard.controller.js';
import { getProfile, getStartup, updateProfile, uploadLogo, uploadCover, getProfileCompletion } from './controllers/profile.controller.js';
import { getFunding, createFundingRound, updateFundingRound, getFundingHistory, updateFundingStatus } from './controllers/funding.controller.js';
import { listInvestorRequests, getInvestorRequest, acceptRequest, rejectRequest, scheduleRequestMeeting, messageInvestor } from './controllers/investor-requests.controller.js';
import { listInvestors, getInvestor, getRecommendedInvestors, getInterestedInvestors, getActiveInvestors } from './controllers/investors.controller.js';
import { getPitchDeck, uploadPitchDeck, updatePitchDeck, deletePitchDeck } from './controllers/pitch-deck.controller.js';
import { getBusinessPlan, createBusinessPlan, updateBusinessPlan } from './controllers/business-plan.controller.js';
import { getTeam, inviteTeamMember, updateTeamMember, removeTeamMember } from './controllers/team.controller.js';
import { listDocuments, uploadDocument, getDocument, downloadDocument, deleteDocument } from './controllers/documents.controller.js';
import { listMeetings, scheduleMeeting, getMeeting, rescheduleMeeting, cancelMeeting, addMeetingNotes } from './controllers/meetings.controller.js';
import { listConversations, getConversation, sendMessage, markMessageRead, uploadAttachment } from './controllers/messages.controller.js';
import { getAnalytics } from './controllers/analytics.controller.js';
import { getReports, getFundingReport, getInvestorsReport, getMeetingsReport, exportReport } from './controllers/reports.controller.js';
import { getCurrentPlan, getPlans, purchasePlan, renewPlan, upgradePlan, cancelPlan } from './controllers/subscriptions.controller.js';
import { getWallet, getTransactions } from './controllers/wallet.controller.js';
import { listInvoices, getInvoice, downloadInvoice } from './controllers/invoices.controller.js';
import { getSettings, updateSettings } from './controllers/settings.controller.js';
import { globalSearch } from './controllers/search.controller.js';
import { listIdeas, getIdeaDetails, createIdea, updateIdea, deleteIdea } from './controllers/ideas.controller.js';
import { getReceivedReviews, getAverageRating, getRatingBreakdown, replyToReview } from './controllers/reviews.controller.js';
import { listProjects as listClientProjects, createProject, updateProject, deleteProject, updateProjectStatus, getProjectDetails, inviteFreelancer } from '../client/controllers/projects.controller.js';
import { listProjectProposals } from '../client/controllers/proposals.controller.js';
import { listInvestments, getInvestment } from '../investor/controllers/investments.controller.js';
import { listContracts, getContractDetails } from '../freelancer/controllers/contracts.controller.js';

const router = Router();

// Auth + Role guard on all founder routes
router.use(authenticate);
router.use(authorizeRole(['freelancer', 'client', 'investor', 'founder']));

// Dashboard
router.get('/dashboard', getDashboard);

// Projects (Universal Access)
router.get('/projects', listClientProjects);
router.post('/projects', createProject);
router.get('/projects/:id', getProjectDetails);
router.get('/projects/:projectId/proposals', listProjectProposals);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);
router.patch('/projects/:id/status', updateProjectStatus);
router.post('/projects/:id/invite', inviteFreelancer);

// Startup Ideas
router.get('/ideas', listIdeas);
router.get('/startups/my-startups', listIdeas);
router.get('/startups', listIdeas);
router.post('/ideas', createIdea);
router.post('/startups', createIdea);
router.get('/ideas/:id', getIdeaDetails);
router.put('/ideas/:id', updateIdea);
router.delete('/ideas/:id', deleteIdea);

// Deals & Investments
router.get('/deals', listInvestments);
router.get('/deals/:id', getInvestment);
router.get('/investments', listInvestments);
router.get('/investments/:id', getInvestment);

// Contracts
router.get('/contracts', listContracts);
router.get('/contracts/:id', getContractDetails);

// Profile
router.get('/profile', getProfile);
router.put('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.patch('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.get('/startup', getStartup);
router.post('/startup', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.put('/startup', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.patch('/startup', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/startup/logo', upload.single('file'), handleUploadError, uploadLogo);
router.post('/startup/cover', upload.single('file'), handleUploadError, uploadCover);
router.get('/startup/completion', getProfileCompletion);

// Funding
router.get('/funding', getFunding);
router.post('/funding', createFundingRound);
router.get('/funding/history', getFundingHistory);
router.put('/funding/:id', updateFundingRound);
router.patch('/funding/:id/status', updateFundingStatus);

// Investor Requests
router.get('/investor-requests', listInvestorRequests);
router.get('/investor-requests/:id', getInvestorRequest);
router.patch('/investor-requests/:id/accept', acceptRequest);
router.patch('/investor-requests/:id/reject', rejectRequest);
router.patch('/investor-requests/:id/meeting', scheduleRequestMeeting);
router.post('/investor-requests/:id/message', messageInvestor);

// Investors
router.get('/investors', listInvestors);
router.get('/investors/recommended', getRecommendedInvestors);
router.get('/investors/interested', getInterestedInvestors);
router.get('/investors/active', getActiveInvestors);
router.get('/investors/:id', getInvestor);

// Pitch Deck
router.get('/pitch-deck', getPitchDeck);
router.post('/pitch-deck', upload.single('file'), handleUploadError, uploadPitchDeck);
router.put('/pitch-deck', updatePitchDeck);
router.delete('/pitch-deck', deletePitchDeck);

// Business Plan
router.get('/business-plan', getBusinessPlan);
router.post('/business-plan', createBusinessPlan);
router.put('/business-plan', updateBusinessPlan);

// Team
router.get('/team', getTeam);
router.post('/team', inviteTeamMember);
router.put('/team/:id', updateTeamMember);
router.delete('/team/:id', removeTeamMember);

// Documents
router.get('/documents', listDocuments);
router.post('/documents/upload', upload.single('file'), handleUploadError, uploadDocument);
router.get('/documents/:id', getDocument);
router.get('/documents/:id/download', downloadDocument);
router.delete('/documents/:id', deleteDocument);

// Meetings
router.get('/meetings', listMeetings);
router.post('/meetings', scheduleMeeting);
router.get('/meetings/:id', getMeeting);
router.patch('/meetings/:id/reschedule', rescheduleMeeting);
router.patch('/meetings/:id/cancel', cancelMeeting);
router.post('/meetings/:id/notes', addMeetingNotes);

// Messages
router.get('/messages/conversations', listConversations);
router.get('/messages/conversations/:id', getConversation);
router.post('/messages/send', sendMessage);
router.patch('/messages/:id/read', markMessageRead);
router.post('/messages/attachments', chatUpload.single('file'), handleUploadError, uploadAttachment);

// Analytics
router.get('/analytics', getAnalytics);

// Reports
router.get('/reports', getReports);
router.get('/reports/funding', getFundingReport);
router.get('/reports/investors', getInvestorsReport);
router.get('/reports/meetings', getMeetingsReport);
router.get('/reports/export', exportReport);

// Subscriptions
router.get('/subscription', getCurrentPlan);
router.get('/subscription/current', getCurrentPlan);
router.get('/subscription/plans', getPlans);
router.post('/subscription/purchase', purchasePlan);
router.post('/subscription/renew', renewPlan);
router.post('/subscription/upgrade', upgradePlan);
router.post('/subscription/cancel', cancelPlan);
router.get('/subscriptions', getCurrentPlan);
router.get('/subscriptions/current', getCurrentPlan);
router.get('/subscriptions/plans', getPlans);
router.post('/subscriptions/purchase', purchasePlan);
router.post('/subscriptions/renew', renewPlan);
router.post('/subscriptions/upgrade', upgradePlan);
router.post('/subscriptions/cancel', cancelPlan);

// Wallet
router.get('/wallet', getWallet);
router.get('/wallet/transactions', getTransactions);

// Invoices
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoice);
router.get('/invoices/:id/download', downloadInvoice);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Reviews
router.get('/reviews', getReceivedReviews);
router.get('/reviews/average', getAverageRating);
router.get('/reviews/breakdown', getRatingBreakdown);

// Watchlist
router.get('/watchlist', getWatchlist);
router.post('/watchlist', addToWatchlist);
router.delete('/watchlist/:id', removeFromWatchlist);
router.patch('/watchlist/:id/notes', updateWatchlistNotes);
router.patch('/watchlist/:id/priority', updateWatchlistPriority);

// Search
router.get('/search', globalSearch);

// Verification
router.get('/verification', getMyVerification as any);
router.patch('/verification', updateMyVerification as any);
router.delete('/verification', deleteMyVerification as any);

export default router;
