import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { authorizeRole } from '../../../middlewares/auth.js';

// Controllers
import { getDashboard } from './controllers/dashboard.controller.js';
import { getProfile, updateProfile, uploadAvatar, uploadCoverImage, uploadResume, uploadKyc } from './controllers/profile.controller.js';
import { listProjects, getProjectDetails, searchProjects, appliedProjects, invitedProjects, savedProjects, recommendedProjects, nearbyProjects, saveProject, unsaveProject } from './controllers/projects.controller.js';
import { listProposals, createProposal, getProposalDetails, updateProposal, withdrawProposal } from './controllers/proposals.controller.js';
import { listContracts, getContractDetails, acceptContract, rejectContract, getContractMilestones, getContractTimeline, getContractDocuments } from './controllers/contracts.controller.js';
import { listTasks, getTaskDetails, updateTaskStatus, startTimer, stopTimer, manualTimeLog } from './controllers/tasks.controller.js';
import { listMeetings, getMeetingDetails, getUpcomingMeetings } from './controllers/meetings.controller.js';
import { listConversations, getConversationDetails, sendMessage, deleteMessage } from './controllers/messages.controller.js';
import { getWalletSummary, getTransactions, getCredits, getDebits, getPendingPayouts, getPaymentHistory, requestWithdrawal } from './controllers/wallet.controller.js';
import { getMonthlyEarnings, getYearlyEarnings, getCategoryEarnings, getClientEarnings, downloadStatement } from './controllers/earnings.controller.js';
import { getReceivedReviews, getAverageRating, getRatingBreakdown, replyToReview } from './controllers/reviews.controller.js';
import { getCurrentPlan, getAvailablePlans, upgradePlan, renewPlan, cancelPlan, getUsage, getBenefits } from './controllers/subscriptions.controller.js';
import { listDocuments, uploadDocument, deleteDocument, downloadDocument, previewDocument } from './controllers/documents.controller.js';
import { upload, handleUploadError } from '../../../middleware/upload.js';
import { rejectLocalFilePaths } from '../../../middlewares/reject-local-file-paths.middleware.js';
import { getSettings, updateSettings } from './controllers/settings.controller.js';
import { getAnalytics, getReports, getEarningsReport, getProjectsReport, getClientsReport, exportReport } from './controllers/analytics.controller.js';
import { globalSearch, searchProjects as searchProjectsGlobal, searchClients, searchBySkill } from './controllers/search.controller.js';
import {
  listPortfolio,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} from './controllers/portfolio.controller.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
} from '../notifications/controllers/notifications.controller.js';

import { getMyVerification, updateMyVerification, deleteMyVerification } from '../../../controllers/verification/verification.controller.js';

import {
  getFreelancerExperience,
  putFreelancerExperience,
  postFreelancerExperience,
  deleteFreelancerExperience,
  putFreelancerExperienceById,
  getFreelancerEducation,
  putFreelancerEducation,
  postFreelancerEducation,
  deleteFreelancerEducation,
  putFreelancerEducationById,
  getFreelancerEducationByUserId,
  getFreelancerCertificates,
  putFreelancerCertificates,
  postFreelancerCertificates,
  deleteFreelancerCertificates,
  putFreelancerCertificateById,
  getFreelancerResume,
  putFreelancerResume,
  exportFreelancerResumePdf,
} from '../../../controllers/freelancer/freelancer-extra.controller.js';

import {
  getFreelancerResumeShare,
  createFreelancerResumeShare,
  updateFreelancerResumeShare,
  regenerateFreelancerResumeShare,
  updateFreelancerResumeShareSnapshot,
  deleteFreelancerResumeShare
} from '../../../controllers/freelancer/freelancer-resume-share.controller.js';

// removed obsolete verification imports
// imports from freelancer.controller.js were here

const router = Router();

// Apply auth + role guard to all freelancer routes
router.use(authenticate);
router.use(authorizeRole('freelancer'));

// ─── Dashboard ───
router.get('/dashboard', getDashboard);

// ─── Profile ───
router.get('/profile', getProfile);
router.put('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.patch('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile/avatar', upload.single('file'), handleUploadError, uploadAvatar);
router.post('/profile/cover', upload.single('file'), handleUploadError, uploadCoverImage);
router.post('/profile/resume', upload.single('file'), handleUploadError, uploadResume);
router.post('/profile/kyc', upload.single('file'), handleUploadError, uploadKyc);

// ─── Professional Details (Experience) ───
router.get('/experience', getFreelancerExperience as any);
router.post('/experience', postFreelancerExperience as any);
router.put('/experience', putFreelancerExperience as any);
router.put('/experience/:id', putFreelancerExperienceById as any);
router.delete('/experience/:id', deleteFreelancerExperience as any);

// ─── Education ───
router.get('/education', getFreelancerEducation as any);
router.put('/education', putFreelancerEducation as any);
router.post('/education', postFreelancerEducation as any);
router.delete('/education/:id', deleteFreelancerEducation as any);
router.put('/education/:id', putFreelancerEducationById as any);
router.get('/education/:userId', getFreelancerEducationByUserId as any);

// ─── Certificates ───
router.get('/certificates', getFreelancerCertificates as any);
router.put('/certificates', putFreelancerCertificates as any);
router.post('/certificates', postFreelancerCertificates as any);
router.delete('/certificates/:id', deleteFreelancerCertificates as any);
router.put('/certificates/:id', putFreelancerCertificateById as any);

// ─── Verification ───
router.get('/verification', getMyVerification as any);
router.patch('/verification', updateMyVerification as any);
router.delete('/verification', deleteMyVerification as any);

// ─── Resume Builder ───
router.get('/resume', getFreelancerResume as any);
router.put('/resume', putFreelancerResume as any);
router.post('/resume/export/pdf', exportFreelancerResumePdf as any);

router.get('/resume/share', getFreelancerResumeShare as any);
router.post('/resume/share', createFreelancerResumeShare as any);
router.put('/resume/share', updateFreelancerResumeShare as any);
router.post('/resume/share/regenerate', regenerateFreelancerResumeShare as any);
router.post('/resume/share/update-snapshot', updateFreelancerResumeShareSnapshot as any);
router.delete('/resume/share', deleteFreelancerResumeShare as any);

// ─── Projects ───
router.get('/projects', listProjects);
router.get('/projects/applied', appliedProjects);
router.get('/projects/invited', invitedProjects);
router.get('/projects/saved', savedProjects);
router.post('/projects/:id/save', saveProject);
router.delete('/projects/:id/save', unsaveProject);
router.get('/projects/recommended', recommendedProjects);
router.get('/projects/nearby', nearbyProjects);
router.get('/projects/search', searchProjects);
router.get('/projects/:id', getProjectDetails);

// ─── Proposals ───
router.get('/proposals', listProposals);
router.post('/proposals', createProposal);
router.get('/proposals/:id', getProposalDetails);
router.put('/proposals/:id', updateProposal);
router.patch('/proposals/:id', updateProposal);
router.delete('/proposals/:id/withdraw', withdrawProposal);

// ─── Contracts ───
router.get('/contracts', listContracts);
router.get('/contracts/:id', getContractDetails);
router.post('/contracts/:id/accept', acceptContract);
router.post('/contracts/:id/reject', rejectContract);
router.get('/contracts/:id/milestones', getContractMilestones);
router.get('/contracts/:id/timeline', getContractTimeline);
router.get('/contracts/:id/documents', getContractDocuments);

// ─── Tasks ───
router.get('/tasks', listTasks);
router.get('/tasks/:id', getTaskDetails);
router.patch('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/timer/start', startTimer);
router.post('/tasks/:id/timer/stop', stopTimer);
router.post('/tasks/:id/time-log', manualTimeLog);

// ─── Meetings ───
router.get('/meetings', listMeetings);
router.get('/meetings/upcoming', getUpcomingMeetings);
router.get('/meetings/:id', getMeetingDetails);

// ─── Messages ───
router.get('/messages', listConversations);
router.get('/messages/:id', getConversationDetails);
router.post('/messages', sendMessage);
router.delete('/messages/:id', deleteMessage);

// ─── Wallet ───
router.get('/wallet', getWalletSummary);
router.get('/wallet/transactions', getTransactions);
router.get('/wallet/credits', getCredits);
router.get('/wallet/debits', getDebits);
router.get('/wallet/pending-payouts', getPendingPayouts);
router.get('/wallet/payment-history', getPaymentHistory);
router.post('/wallet/withdraw', requestWithdrawal);

// ─── Earnings ───
router.get('/earnings/monthly', getMonthlyEarnings);
router.get('/earnings/yearly', getYearlyEarnings);
router.get('/earnings/by-category', getCategoryEarnings);
router.get('/earnings/by-client', getClientEarnings);
router.get('/earnings/statement', downloadStatement);

// ─── Reviews ───
router.get('/reviews', getReceivedReviews);
router.get('/reviews/average', getAverageRating);
router.get('/reviews/breakdown', getRatingBreakdown);
router.post('/reviews/:id/reply', replyToReview);

// ─── Subscriptions ───
router.get('/subscription', getCurrentPlan);
router.get('/subscription/current', getCurrentPlan);
router.get('/subscription/plans', getAvailablePlans);
router.post('/subscription/upgrade', upgradePlan);
router.post('/subscription/renew', renewPlan);
router.post('/subscription/cancel', cancelPlan);
router.get('/subscription/usage', getUsage);
router.get('/subscription/benefits', getBenefits);
router.get('/subscriptions', getCurrentPlan);
router.get('/subscriptions/current', getCurrentPlan);
router.get('/subscriptions/plans', getAvailablePlans);
router.post('/subscriptions/upgrade', upgradePlan);
router.post('/subscriptions/renew', renewPlan);
router.post('/subscriptions/cancel', cancelPlan);
router.get('/subscriptions/usage', getUsage);
router.get('/subscriptions/benefits', getBenefits);

// ─── Documents ───
router.get('/documents', listDocuments);
router.post('/documents/upload', upload.single('file'), handleUploadError, uploadDocument);
router.get('/documents/:id/download', downloadDocument);
router.get('/documents/:id/preview', previewDocument);
router.delete('/documents/:id', deleteDocument);

// ─── Portfolio ───
router.get('/portfolio', listPortfolio);
router.post('/portfolio', createPortfolioItem);
router.get('/portfolio/:id', getPortfolioItem);
router.put('/portfolio/:id', updatePortfolioItem);
router.delete('/portfolio/:id', deletePortfolioItem);

// ─── Notifications (role-prefixed aliases of /notifications) ───
router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.patch('/notifications/read-all', markAllAsRead);
router.patch('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);
router.get('/notifications/preferences', getPreferences);
router.put('/notifications/preferences', updatePreferences);

// ─── Settings ───
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// ─── Analytics ───
router.get('/analytics', getAnalytics);
router.get('/analytics/reports', getReports);
router.get('/analytics/earnings', getEarningsReport);
router.get('/analytics/projects', getProjectsReport);
router.get('/analytics/clients', getClientsReport);
router.post('/analytics/export', exportReport);

// ─── Search ───
router.get('/search', globalSearch);
router.get('/search/projects', searchProjectsGlobal);
router.get('/search/clients', searchClients);
router.get('/search/skills', searchBySkill);

export default router;
