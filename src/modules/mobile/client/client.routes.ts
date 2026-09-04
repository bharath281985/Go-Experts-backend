import { Router } from 'express';
import { getMyVerification, updateMyVerification, deleteMyVerification } from '../../../controllers/verification/verification.controller.js';
import { authenticate, authorizeRole } from '../../../middlewares/auth.js';

// Controllers
import { getDashboard } from './controllers/dashboard.controller.js';
import { getProfile, updateProfile, uploadLogo, uploadCover, uploadDocuments, getProfileCompletion, uploadKyc } from './controllers/profile.controller.js';
import { listProjects, createProject, getProjectDetails, updateProject, deleteProject, updateProjectStatus, addAttachment, getProjectTimeline, shareProject, inviteFreelancer } from './controllers/projects.controller.js';
import { listProposals, listProjectProposals, getProposal, shortlistProposal, rejectProposal, interviewProposal, acceptProposal, messageFreelancer } from './controllers/proposals.controller.js';
import { listFreelancers, getFreelancer, getRecommendedFreelancers, saveFreelancer, unsaveFreelancer, getSavedFreelancers } from './controllers/freelancers.controller.js';
import { listContracts, getContract, createContract, activateContract, completeContract, cancelContract, getContractMilestones, addContractMilestone } from './controllers/contracts.controller.js';
import { listTasks, createTask, getTask, updateTask, updateTaskStatus, addTaskComment, addTaskAttachment, getTaskTimeLogs } from './controllers/tasks.controller.js';
import { listMilestones, getMilestone, approveMilestone, rejectMilestone, releasePayment } from './controllers/milestones.controller.js';
import { listMeetings, scheduleMeeting, getMeeting, rescheduleMeeting, cancelMeeting, addMeetingNotes } from './controllers/meetings.controller.js';
import { listConversations, getConversation, sendMessage, markMessageRead, markConversationRead, markConversationUnread, deleteMessage, deleteConversation, uploadAttachment } from './controllers/messages.controller.js';
import { upload, chatUpload, handleUploadError } from '../../../middleware/upload.js';
import { rejectLocalFilePaths } from '../../../middlewares/reject-local-file-paths.middleware.js';
import { listPayments, getPayment, initiatePayment, verifyPayment, getPaymentHistory } from './controllers/payments.controller.js';
import { listInvoices, getInvoice, downloadInvoice } from './controllers/invoices.controller.js';
import { getWallet, getTransactions } from './controllers/wallet.controller.js';
import { listReviews, createReview, updateReview, deleteReview, getAverageRating, getRatingBreakdown } from './controllers/reviews.controller.js';
import { getCurrentPlan, getPlans, purchasePlan, renewPlan, upgradePlan, cancelPlan } from './controllers/subscriptions.controller.js';
import { listTickets, createTicket, getTicket, replyToTicket, closeTicket } from './controllers/support.controller.js';
import { listDocuments, uploadDocument, getDocument, downloadDocument, deleteDocument } from './controllers/documents.controller.js';
import { listIdeas, getIdeaDetails, createIdea, updateIdea, deleteIdea } from '../founder/controllers/ideas.controller.js';
import { listInvestments, getInvestment } from '../investor/controllers/investments.controller.js';
import { getAnalytics, getReports, getSpendReport, getProjectsReport, getFreelancersReport, exportReport } from './controllers/analytics.controller.js';

const router = Router();

// Auth + Role guard on all client routes
router.use(authenticate);
router.use(authorizeRole(['freelancer', 'client', 'investor', 'founder']));

// ─── Dashboard ───
router.get('/dashboard', getDashboard);

// ─── Profile ───
router.get('/profile', getProfile);
router.put('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.patch('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile', upload.single('file'), handleUploadError, rejectLocalFilePaths, updateProfile);
router.post('/profile/logo', upload.single('file'), handleUploadError, uploadLogo);
router.post('/profile/cover', upload.single('file'), handleUploadError, uploadCover);
router.post('/profile/documents', upload.single('file'), handleUploadError, uploadDocuments);
router.post('/profile/kyc', upload.single('file'), handleUploadError, uploadKyc);
router.get('/profile/completion', getProfileCompletion);

// ─── Projects ───
router.get('/projects', listProjects);
router.post('/projects', createProject);
router.get('/projects/:id', getProjectDetails);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);
router.patch('/projects/:id/status', updateProjectStatus);
router.post('/projects/:id/invite', inviteFreelancer);
router.post('/projects/:id/attachments', addAttachment);
router.get('/projects/:id/timeline', getProjectTimeline);
router.post('/projects/:id/share', shareProject);
router.get('/projects/:projectId/proposals', listProjectProposals);

// ─── Startups / Ideas / Deals (Universal Access) ───
router.get('/ideas', listIdeas);
router.post('/ideas', createIdea);
router.get('/ideas/:id', getIdeaDetails);
router.put('/ideas/:id', updateIdea);
router.delete('/ideas/:id', deleteIdea);
router.post('/startups', createIdea);
router.get('/startups/my-startups', listIdeas);
router.get('/deals', listInvestments);
router.get('/deals/:id', getInvestment);
router.get('/investments', listInvestments);
router.get('/investments/:id', getInvestment);

// ─── Proposals ───
router.get('/proposals', listProposals);
router.get('/proposals/:id', getProposal);
router.patch('/proposals/:id/shortlist', shortlistProposal);
router.patch('/proposals/:id/reject', rejectProposal);
router.patch('/proposals/:id/interview', interviewProposal);
router.patch('/proposals/:id/accept', acceptProposal);
router.post('/proposals/:id/message', messageFreelancer);

// ─── Freelancer Discovery ───
router.get('/freelancers', listFreelancers);
router.get('/freelancers/recommended', getRecommendedFreelancers);
router.get('/freelancers/saved', getSavedFreelancers);
router.get('/freelancers/:id', getFreelancer);
router.post('/freelancers/:id/save', saveFreelancer);
router.delete('/freelancers/:id/save', unsaveFreelancer);

// ─── Contracts ───
router.get('/contracts', listContracts);
router.post('/contracts', createContract);
router.get('/contracts/:id', getContract);
router.patch('/contracts/:id/activate', activateContract);
router.patch('/contracts/:id/complete', completeContract);
router.patch('/contracts/:id/cancel', cancelContract);
router.get('/contracts/:id/milestones', getContractMilestones);
router.post('/contracts/:id/milestones', addContractMilestone);

// ─── Tasks ───
router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.get('/tasks/:id', getTask);
router.put('/tasks/:id', updateTask);
router.patch('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/comments', addTaskComment);
router.post('/tasks/:id/attachments', addTaskAttachment);
router.get('/tasks/:id/time-logs', getTaskTimeLogs);

// ─── Milestones ───
router.get('/milestones', listMilestones);
router.get('/milestones/:id', getMilestone);
router.patch('/milestones/:id/approve', approveMilestone);
router.patch('/milestones/:id/reject', rejectMilestone);
router.patch('/milestones/:id/release-payment', releasePayment);

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
router.delete('/messages/:id', deleteMessage);
router.patch('/messages/conversations/:id/read-all', markConversationRead);
router.patch('/messages/conversations/:id/unread', markConversationUnread);
router.delete('/messages/conversations/:id', deleteConversation);
router.post('/messages/attachments', chatUpload.single('file'), handleUploadError, uploadAttachment);

// ─── Payments ───
router.get('/payments', listPayments);
router.get('/payments/history', getPaymentHistory);
router.post('/payments/initiate', initiatePayment);
router.post('/payments/verify', verifyPayment);
router.get('/payments/:id', getPayment);

// ─── Invoices ───
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoice);
router.get('/invoices/:id/download', downloadInvoice);

// ─── Wallet ───
router.get('/wallet', getWallet);
router.get('/wallet/transactions', getTransactions);

// ─── Reviews ───
router.get('/reviews', listReviews);
router.get('/reviews/average', getAverageRating);
router.get('/reviews/breakdown', getRatingBreakdown);
router.post('/reviews', createReview);
router.put('/reviews/:id', updateReview);
router.delete('/reviews/:id', deleteReview);

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

// ─── Notifications ───

// ─── Support ───
router.get('/support/tickets', listTickets);
router.post('/support/tickets', createTicket);
router.get('/support/tickets/:id', getTicket);
router.post('/support/tickets/:id/reply', replyToTicket);
router.patch('/support/tickets/:id/close', closeTicket);

// ─── Documents ───
router.get('/documents', listDocuments);
router.post('/documents/upload', upload.single('file'), handleUploadError, uploadDocument);
router.get('/documents/:id', getDocument);
router.get('/documents/:id/download', downloadDocument);
router.delete('/documents/:id', deleteDocument);

// ─── Team ───
router.get('/team', getTeam);
router.post('/team/invite', inviteTeamMember);
router.patch('/team/:id/role', updateTeamMemberRole);
router.delete('/team/:id', removeTeamMember);

// ─── Analytics & Reports ───
router.get('/analytics', getAnalytics);
router.get('/reports', getReports);
router.get('/reports/spend', getSpendReport);
router.get('/reports/projects', getProjectsReport);
router.get('/reports/freelancers', getFreelancersReport);
router.get('/reports/export', exportReport);

// ─── Verification ───
router.get('/verification', getMyVerification as any);
router.patch('/verification', updateMyVerification as any);
router.delete('/verification', deleteMyVerification as any);

export default router;
