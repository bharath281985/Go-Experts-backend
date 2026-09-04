import { Router } from 'express';
import { getMyVerification, updateMyVerification, deleteMyVerification } from '../../../controllers/verification/verification.controller.js';
import { upload, chatUpload, handleUploadError } from '../../../middleware/upload.js';
import { authenticate, authorizeRole, AuthRequest } from '../../../middlewares/auth.js';
import { rejectLocalFilePaths } from '../../../middlewares/reject-local-file-paths.middleware.js';

// Controllers
import { getDashboard } from './controllers/dashboard.controller.js';
import { getProfile, updateProfile, uploadAvatar, uploadCover, uploadDocuments, getProfileCompletion } from './controllers/profile.controller.js';
import { listStartups, getStartupDetails, getRecommendedStartups, getTrendingStartups, getFeaturedStartups, saveStartup, unsaveStartup } from './controllers/startups.controller.js';
import { getWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistNotes, updateWatchlistPriority, getFounderWatchlist, saveFounder, unsaveFounder } from './controllers/watchlist.controller.js';
import { listInvestments, getInvestment, expressInterest, makeOffer, updateInvestmentStatus, cancelInvestment, getInvestmentHistory } from './controllers/investments.controller.js';
import {
  getPortfolio,
  getPortfolioItem,
  getPortfolioPerformance,
  getPortfolioAllocation,
  getPortfolioROI,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} from './controllers/portfolio.controller.js';
import { listMeetings, scheduleMeeting, getMeeting, rescheduleMeeting, cancelMeeting, addMeetingNotes } from './controllers/meetings.controller.js';
import { listConversations, getConversation, sendMessage, markMessageRead, uploadAttachment } from './controllers/messages.controller.js';
import { listDocuments, getDocument, uploadDocument, deleteDocument } from './controllers/documents.controller.js';
import { getReports, getPortfolioReport, getRoiReport, getIndustryReport, exportReport } from './controllers/reports.controller.js';
import { getAnalytics } from './controllers/analytics.controller.js';
import { getCurrentPlan, getPlans, purchasePlan, renewPlan, upgradePlan, cancelPlan } from './controllers/subscriptions.controller.js';
import { getWallet, getTransactions } from './controllers/wallet.controller.js';
import { listInvoices, getInvoice, downloadInvoice } from './controllers/invoices.controller.js';
import { getSettings, updateSettings } from './controllers/settings.controller.js';
import { listReviews, getAverageRating, getRatingBreakdown } from './controllers/reviews.controller.js';
import { globalSearch } from './controllers/search.controller.js';
import { getWatchlist as getWatchlistFounder, addToWatchlist as addToWatchlistFounder, removeFromWatchlist as removeFromWatchlistFounder, updateWatchlistNotes as updateWatchlistNotesFounder, updateWatchlistPriority as updateWatchlistPriorityFounder } from '../founder/controllers/watchlist.controller.js';
import { listProjects as listClientProjects, createProject, updateProject, deleteProject, updateProjectStatus, getProjectDetails } from '../client/controllers/projects.controller.js';
import { listProjectProposals } from '../client/controllers/proposals.controller.js';
import { listIdeas, getIdeaDetails, createIdea, updateIdea, deleteIdea } from '../founder/controllers/ideas.controller.js';

const router = Router();

// Auth + Role guard on all investor routes
router.use(authenticate);

// ─── Dual-Personality Watchlist Routes (Investor or Founder payload depending on logged in user) ───
router.get('/watchlist', (req: AuthRequest, res, next) => {
  if (req.user?.role === 'founder') return getWatchlistFounder(req, res, next);
  return getWatchlist(req, res, next);
});
router.post('/watchlist', (req: AuthRequest, res, next) => {
  if (req.user?.role === 'founder') return addToWatchlistFounder(req, res, next);
  return addToWatchlist(req, res, next);
});
router.delete('/watchlist/:id', (req: AuthRequest, res, next) => {
  if (req.user?.role === 'founder') return removeFromWatchlistFounder(req, res, next);
  return removeFromWatchlist(req, res, next);
});
router.patch('/watchlist/:id/notes', (req: AuthRequest, res, next) => {
  if (req.user?.role === 'founder') return updateWatchlistNotesFounder(req, res, next);
  return updateWatchlistNotes(req, res, next);
});
router.patch('/watchlist/:id/priority', (req: AuthRequest, res, next) => {
  if (req.user?.role === 'founder') return updateWatchlistPriorityFounder(req, res, next);
  return updateWatchlistPriority(req, res, next);
});

router.use(authorizeRole(['freelancer', 'client', 'investor', 'founder']));

// ─── Dashboard ───
router.get('/dashboard', getDashboard);

// ─── Projects (Universal Access) ───
router.get('/projects', listClientProjects);
router.post('/projects', createProject);
router.get('/projects/:id', getProjectDetails);
router.get('/projects/:projectId/proposals', listProjectProposals);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);
router.patch('/projects/:id/status', updateProjectStatus);

// ─── Startups / Ideas (Universal Access) ───
router.get('/ideas', listIdeas);
router.post('/ideas', createIdea);
router.get('/ideas/:id', getIdeaDetails);
router.put('/ideas/:id', updateIdea);
router.delete('/ideas/:id', deleteIdea);
router.post('/startups', createIdea);
router.get('/startups/my-startups', listIdeas);

router.get('/profile', getProfile);
router.put('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.patch('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile/avatar', upload.single('file'), handleUploadError, uploadAvatar);
router.post('/profile/cover', upload.single('file'), handleUploadError, uploadCover);
router.post('/profile/documents', upload.single('file'), handleUploadError, uploadDocuments);
router.get('/profile/completion', getProfileCompletion);

// ─── Startup Discovery ───
router.get('/startups', listStartups);
router.get('/startups/recommended', getRecommendedStartups);
router.get('/startups/trending', getTrendingStartups);
router.get('/startups/featured', getFeaturedStartups);
router.get('/startups/:id', getStartupDetails);
router.post('/startups/:id/save', saveStartup);
router.delete('/startups/:id/save', unsaveStartup);

// ─── Founder Discovery & Watchlist ───
router.get('/watchlist/founders', getFounderWatchlist);
router.post('/founders/:id/save', saveFounder);
router.delete('/founders/:id/save', unsaveFounder);

// ─── Investments ───
router.get('/investments', listInvestments);
router.get('/investments/history', getInvestmentHistory);
router.get('/investments/:id', getInvestment);
router.post('/investments/express-interest', expressInterest);
router.post('/investments/offer', makeOffer);
router.patch('/investments/:id/status', updateInvestmentStatus);
router.patch('/investments/:id/cancel', cancelInvestment);

// ─── Portfolio ───
router.get('/portfolio', getPortfolio);
router.post('/portfolio', addPortfolioItem);
router.put('/portfolio/:id', updatePortfolioItem);
router.delete('/portfolio/:id', deletePortfolioItem);
router.get('/portfolio/performance', getPortfolioPerformance);
router.get('/portfolio/allocation', getPortfolioAllocation);
router.get('/portfolio/roi', getPortfolioROI);
router.get('/portfolio/:id', getPortfolioItem);

// ─── Meetings ───
router.get('/meetings', listMeetings);
router.post('/meetings', scheduleMeeting);
router.get('/meetings/:id', getMeeting);
router.patch('/meetings/:id/reschedule', rescheduleMeeting);
router.patch('/meetings/:id/cancel', cancelMeeting);
router.post('/meetings/:id/notes', addMeetingNotes);

// ─── Messages ───
router.get('/messages/conversations', listConversations);
router.get('/messages/conversations/:id', getConversation);
router.post('/messages/send', sendMessage);
router.patch('/messages/:id/read', markMessageRead);
router.post('/messages/attachments', chatUpload.single('file'), handleUploadError, uploadAttachment);

// ─── Documents ───
router.get('/documents', listDocuments);
router.post('/documents/upload', upload.single('file'), handleUploadError, uploadDocument);
router.get('/documents/:id', getDocument);
router.delete('/documents/:id', deleteDocument);

// ─── Reports ───
router.get('/reports', getReports);
router.get('/reports/portfolio', getPortfolioReport);
router.get('/reports/roi', getRoiReport);
router.get('/reports/industry', getIndustryReport);
router.get('/reports/export', exportReport);

// ─── Analytics ───
router.get('/analytics', getAnalytics);

// ─── Subscriptions ───
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

// ─── Wallet ───
router.get('/wallet', getWallet);
router.get('/wallet/transactions', getTransactions);

// ─── Invoices ───
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoice);
router.get('/invoices/:id/download', downloadInvoice);

// ─── Notifications ───

// ─── Settings ───
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// ─── Reviews ───
router.get('/reviews', listReviews);
router.get('/reviews/average', getAverageRating);
router.get('/reviews/breakdown', getRatingBreakdown);

// ─── Search ───
router.get('/search', globalSearch);

// ─── Verification ───
router.get('/verification', getMyVerification as any);
router.patch('/verification', updateMyVerification as any);
router.delete('/verification', deleteMyVerification as any);

export default router;
