import { Router } from 'express';
import {
  getHomeData, getCategories, getSkills, getIndustries,
  getFreelancers, getClients, getInvestors, getStartups,
  getProjects, shareProject, getPricing, getPricingPlans, getBlogs, getFaqs, getTestimonials,
  submitContact, search, getById,
  getEducationLevels, getExperienceLevels, getStartupStages, getCompanySizes, getTicketSizes,
  getInvestorTypes, getFounderTypes, getFounderRoles, getTeamSizes, getCountries, getStates,
  getBusinessTypes, getServicesTaxonomy, getProjectCategories,
  getWorkModes, getHiringGoals, getInvestorStages, getPlatformGoals, getBudgetRanges,
  getDesignations, getFounderGoals, getAvailabilityOptions
} from './public.controller.js';
import { authenticate, authenticateOptional } from '../../../middlewares/auth.js';
import { cacheControl } from '../../../middleware/cache.js';
import { upload, handleUploadError } from '../../../middleware/upload.js';
import { createProject, updateProject, deleteProject, updateProjectStatus } from '../client/controllers/projects.controller.js';
import { listProjectProposals, getProposal, shortlistProposal, rejectProposal, interviewProposal, acceptProposal, messageFreelancer } from '../client/controllers/proposals.controller.js';
import { listProposals as listMyProposals, createProposal, getProposalDetails, updateProposal, withdrawProposal } from '../freelancer/controllers/proposals.controller.js';
import { createIdea, updateIdea, deleteIdea, listIdeas } from '../founder/controllers/ideas.controller.js';
import { getFunding, createFundingRound, getFundingHistory, updateFundingRound, updateFundingStatus } from '../founder/controllers/funding.controller.js';
import { getPitchDeck, uploadPitchDeck, deletePitchDeck } from '../founder/controllers/pitch-deck.controller.js';
import { getBusinessPlan, createBusinessPlan, updateBusinessPlan } from '../founder/controllers/business-plan.controller.js';
import { listInvestorRequests, getInvestorRequest, acceptRequest, rejectRequest, scheduleRequestMeeting, messageInvestor } from '../founder/controllers/investor-requests.controller.js';
import { listInvestments, getInvestment, makeOffer, expressInterest, cancelInvestment } from '../investor/controllers/investments.controller.js';
import { listTasks as listClientTasks, createTask as createClientTask, getTask as getClientTask, updateTask as updateClientTask, updateTaskStatus as updateClientTaskStatus } from '../client/controllers/tasks.controller.js';
import { startTimer, stopTimer, manualTimeLog } from '../freelancer/controllers/tasks.controller.js';
import { listContracts, getContractDetails, acceptContract, rejectContract } from '../freelancer/controllers/contracts.controller.js';
import { createContract, completeContract, cancelContract } from '../client/controllers/contracts.controller.js';
import { listMeetings, scheduleMeeting, getMeeting, rescheduleMeeting, cancelMeeting, addMeetingNotes } from '../client/controllers/meetings.controller.js';
import { getTeam, inviteTeamMember, removeTeamMember } from '../client/controllers/team.controller.js';
import { getWallet, getTransactions } from '../client/controllers/wallet.controller.js';
import { requestWithdrawal } from '../freelancer/controllers/wallet.controller.js';
import { getReceivedReviews, getAverageRating, getRatingBreakdown, replyToReview } from '../freelancer/controllers/reviews.controller.js';
import { getMyVerification, updateMyVerification, deleteMyVerification } from '../../../controllers/verification/verification.controller.js';
import { saveFreelancer, unsaveFreelancer, getSavedFreelancers } from '../client/controllers/freelancers.controller.js';
import { saveStartup, unsaveStartup } from '../investor/controllers/startups.controller.js';
import { saveFounder, unsaveFounder, getFounderWatchlist } from '../investor/controllers/watchlist.controller.js';

const router = Router();

// Cache static master lists; skills vary by categoryId — short private cache.
const masterCache = cacheControl('1h');
const skillsCache = cacheControl('2m', true);
const directoryCache = cacheControl('5m');

router.get('/home', directoryCache, getHomeData);
router.get('/categories', masterCache, getCategories);
router.get('/skills', skillsCache, getSkills);
router.get('/industries', masterCache, getIndustries);
router.get('/education_levels', masterCache, getEducationLevels as any);
router.get('/experience-levels', masterCache, getExperienceLevels);
router.get('/startup-stages', masterCache, getStartupStages);
router.get('/company-sizes', masterCache, getCompanySizes);
router.get('/ticket-sizes', masterCache, getTicketSizes);
router.get('/investor-types', masterCache, getInvestorTypes);
router.get('/founder-types', masterCache, getFounderTypes);
router.get('/founder_types', masterCache, getFounderTypes);
router.get('/founder-roles', masterCache, getFounderRoles);
router.get('/founder_roles', masterCache, getFounderRoles);
router.get('/business-types', masterCache, getBusinessTypes);
router.get('/services', masterCache, getServicesTaxonomy);
router.get('/project-categories', masterCache, getProjectCategories);
router.get('/team-sizes', masterCache, getTeamSizes);
router.get('/countries', masterCache, getCountries);
router.get('/states', masterCache, getStates);
router.get('/work-modes', masterCache, getWorkModes);
router.get('/availabilities', masterCache, getAvailabilityOptions);
router.get('/availability', masterCache, getAvailabilityOptions);
router.get('/freelancer-availabilities', masterCache, getAvailabilityOptions);
router.get('/hiring-goals', getHiringGoals);
router.get('/investor-stages', masterCache, getInvestorStages);
router.get('/platform-goals', masterCache, getPlatformGoals);
router.get('/budget-ranges', masterCache, getBudgetRanges);
router.get('/hiring-budgets', masterCache, getBudgetRanges);
router.get('/project-budgets', masterCache, getBudgetRanges);
router.get('/project-budget-ranges', masterCache, getBudgetRanges);
router.get('/hiring-budget-ranges', masterCache, getBudgetRanges);
router.get('/designations', masterCache, getDesignations);
router.get('/startup-roles', masterCache, getDesignations);
router.get('/start-roles', masterCache, getDesignations);
router.get('/roles', masterCache, getDesignations);
router.get('/founder-goals', masterCache, getFounderGoals);
router.get('/startup-goals', masterCache, getFounderGoals);
router.get('/freelancers', authenticateOptional, directoryCache, getFreelancers);
router.get('/freelancers/saved', authenticate, getSavedFreelancers);
router.get('/freelancers/:id', authenticateOptional, directoryCache, getById('freelancer'));
router.post('/freelancers/:id/save', authenticate, saveFreelancer);
router.delete('/freelancers/:id/save', authenticate, unsaveFreelancer);
router.get('/clients', directoryCache, getClients);
router.get('/clients/:id', directoryCache, getById('client'));
router.get('/investors', directoryCache, getInvestors);
router.get('/investors/:id', authenticateOptional, getById('investor'));
router.get('/startups', directoryCache, getStartups);
router.get('/startups/my-startups', authenticate, listIdeas);
router.post('/startups', authenticate, createIdea);
router.get('/startups/:id', authenticateOptional, getById('startup'));
router.post('/startups/:id/save', authenticate, saveStartup);
router.delete('/startups/:id/save', authenticate, unsaveStartup);
router.get('/startups/:startupId/investor-requests', authenticate, listInvestorRequests);
router.get('/startups/:startupId/proposals', authenticate, listInvestorRequests);
router.put('/startups/:id', authenticate, updateIdea);
router.delete('/startups/:id', authenticate, deleteIdea);

// ─── Founders & Investors Watchlist ───
router.get('/founders/:id', authenticateOptional, getById('founder'));
router.post('/founders/:id/save', authenticate, saveFounder);
router.delete('/founders/:id/save', authenticate, unsaveFounder);
router.get('/watchlist/founders', authenticate, getFounderWatchlist);

// ─── Funding, Pitch Deck & Business Plan (Universal Access) ───
router.get('/funding', authenticate, getFunding);
router.post('/funding', authenticate, createFundingRound);
router.get('/funding/history', authenticate, getFundingHistory);
router.put('/funding/:id', authenticate, updateFundingRound);
router.patch('/funding/:id/status', authenticate, updateFundingStatus);

router.get('/pitch-deck', authenticate, getPitchDeck);
router.post('/pitch-deck', authenticate, upload.single('file'), handleUploadError, uploadPitchDeck);
router.delete('/pitch-deck', authenticate, deletePitchDeck);

router.get('/business-plan', authenticate, getBusinessPlan);
router.post('/business-plan', authenticate, createBusinessPlan);
router.put('/business-plan', authenticate, updateBusinessPlan);

// ─── Investor Requests on My Startup (Universal Access) ───
router.get('/investor-requests', authenticate, listInvestorRequests);
router.get('/investor-requests/:id', authenticate, getInvestorRequest);
router.patch('/investor-requests/:id/accept', authenticate, acceptRequest);
router.patch('/investor-requests/:id/reject', authenticate, rejectRequest);
router.patch('/investor-requests/:id/meeting', authenticate, scheduleRequestMeeting);
router.post('/investor-requests/:id/message', authenticate, messageInvestor);

// ─── Investment Offers & Portfolio (Universal Access) ───
router.get('/investments', authenticate, listInvestments);
router.get('/investments/:id', authenticate, getInvestment);
router.post('/investments/offer', authenticate, makeOffer);
router.post('/investments/express-interest', authenticate, expressInterest);
router.patch('/investments/:id/cancel', authenticate, cancelInvestment);

router.get('/founders/:id', authenticateOptional, getById('founder'));
router.get('/projects', authenticateOptional, directoryCache, getProjects);
router.post('/projects', authenticate, createProject);
router.get('/projects/:id', authenticateOptional, directoryCache, getById('project'));
router.get('/projects/:projectId/proposals', authenticate, listProjectProposals);
router.put('/projects/:id', authenticate, updateProject);
router.delete('/projects/:id', authenticate, deleteProject);
router.patch('/projects/:id/status', authenticate, updateProjectStatus);
router.post('/projects/:id/share', shareProject);

// ─── Tasks (Universal Access) ───
router.get('/tasks', authenticate, listClientTasks);
router.post('/tasks', authenticate, createClientTask);
router.get('/tasks/:id', authenticate, getClientTask);
router.put('/tasks/:id', authenticate, updateClientTask);
router.patch('/tasks/:id/status', authenticate, updateClientTaskStatus);
router.post('/tasks/:id/timer/start', authenticate, startTimer);
router.post('/tasks/:id/timer/stop', authenticate, stopTimer);
router.post('/tasks/:id/time-log', authenticate, manualTimeLog);

// ─── Proposals & Bidding (Universal Access) ───
router.get('/proposals', authenticate, listMyProposals);
router.post('/proposals', authenticate, createProposal);
router.get('/proposals/:id', authenticate, getProposalDetails);
router.put('/proposals/:id', authenticate, updateProposal);
router.delete('/proposals/:id/withdraw', authenticate, withdrawProposal);
router.patch('/proposals/:id/shortlist', authenticate, shortlistProposal);
router.patch('/proposals/:id/interview', authenticate, interviewProposal);
router.patch('/proposals/:id/accept', authenticate, acceptProposal);
router.patch('/proposals/:id/reject', authenticate, rejectProposal);
router.post('/proposals/:id/message', authenticate, messageFreelancer);

// ─── Contracts (Universal Access) ───
router.get('/contracts', authenticate, listContracts);
router.post('/contracts', authenticate, createContract);
router.get('/contracts/:id', authenticate, getContractDetails);
router.post('/contracts/:id/accept', authenticate, acceptContract);
router.post('/contracts/:id/reject', authenticate, rejectContract);
router.patch('/contracts/:id/complete', authenticate, completeContract);
router.patch('/contracts/:id/cancel', authenticate, cancelContract);

// ─── Meetings & Calendar (Universal Access) ───
router.get('/meetings', authenticate, listMeetings);
router.post('/meetings', authenticate, scheduleMeeting);
router.get('/meetings/:id', authenticate, getMeeting);
router.patch('/meetings/:id/reschedule', authenticate, rescheduleMeeting);
router.patch('/meetings/:id/cancel', authenticate, cancelMeeting);
router.post('/meetings/:id/notes', authenticate, addMeetingNotes);

// ─── Teams (Universal Access) ───
router.get('/team', authenticate, getTeam);
router.post('/team/invite', authenticate, inviteTeamMember);
router.delete('/team/:id', authenticate, removeTeamMember);

// ─── Wallet & Payouts (Universal Access) ───
router.get('/wallet', authenticate, getWallet);
router.get('/wallet/transactions', authenticate, getTransactions);
router.post('/wallet/withdraw', authenticate, requestWithdrawal);

// ─── Reviews & Ratings (Universal Access) ───
router.get('/reviews', authenticate, getReceivedReviews);
router.get('/reviews/breakdown', authenticate, getRatingBreakdown);
router.get('/reviews/average', authenticate, getAverageRating);
router.post('/reviews/:id/reply', authenticate, replyToReview);

// ─── Verification (KYC) (Universal Access) ───
router.get('/verification', authenticate, getMyVerification as any);
router.patch('/verification', authenticate, updateMyVerification as any);
router.delete('/verification', authenticate, deleteMyVerification as any);

router.get('/pricing', masterCache, getPricing);
router.get('/pricing_plans', masterCache, getPricingPlans);
router.get('/blogs', directoryCache, getBlogs);
router.get('/blogs/:id', directoryCache, getById('blog'));
router.get('/faqs', masterCache, getFaqs);
router.get('/testimonials', masterCache, getTestimonials);
router.post('/contact', submitContact);
router.get('/search', directoryCache, search);

router.get('/education_levels', masterCache, getEducationLevels as any);

export default router;
