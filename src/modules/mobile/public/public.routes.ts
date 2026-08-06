import { Router } from 'express';
import {
  getHomeData, getCategories, getSkills, getIndustries,
  getFreelancers, getClients, getInvestors, getStartups,
  getProjects, shareProject, getPricing, getBlogs, getFaqs, getTestimonials,
  submitContact, search, getById,
  getExperienceLevels, getStartupStages, getCompanySizes, getTicketSizes,
  getInvestorTypes, getFounderTypes, getTeamSizes, getCountries, getStates,
  getBusinessTypes, getServicesTaxonomy, getProjectCategories
} from './public.controller.js';
import { authenticateOptional } from '../../../middlewares/auth.js';
import { cacheControl } from '../../../middleware/cache.js';

const router = Router();

// Cache static master lists; skills vary by categoryId — short private cache.
const masterCache = cacheControl('1h');
const skillsCache = cacheControl('2m', true);
const directoryCache = cacheControl('5m');

router.get('/home', directoryCache, getHomeData);
router.get('/categories', masterCache, getCategories);
router.get('/skills', skillsCache, getSkills);
router.get('/industries', masterCache, getIndustries);
router.get('/experience-levels', masterCache, getExperienceLevels);
router.get('/startup-stages', masterCache, getStartupStages);
router.get('/company-sizes', masterCache, getCompanySizes);
router.get('/ticket-sizes', masterCache, getTicketSizes);
router.get('/investor-types', masterCache, getInvestorTypes);
router.get('/founder-types', masterCache, getFounderTypes);
router.get('/business-types', masterCache, getBusinessTypes);
router.get('/services', masterCache, getServicesTaxonomy);
router.get('/project-categories', masterCache, getProjectCategories);
router.get('/team-sizes', masterCache, getTeamSizes);
router.get('/countries', masterCache, getCountries);
router.get('/states', masterCache, getStates);
router.get('/freelancers', directoryCache, getFreelancers);
router.get('/freelancers/:id', directoryCache, getById('freelancer'));
router.get('/clients', directoryCache, getClients);
router.get('/clients/:id', directoryCache, getById('client'));
router.get('/investors', directoryCache, getInvestors);
router.get('/investors/:id', directoryCache, getById('investor'));
router.get('/startups', directoryCache, getStartups);
router.get('/startups/:id', authenticateOptional, getById('startup'));
router.get('/founders/:id', authenticateOptional, getById('founder'));
router.get('/projects', directoryCache, getProjects);
router.get('/projects/:id', directoryCache, getById('project'));
router.post('/projects/:id/share', shareProject);
router.get('/pricing', masterCache, getPricing);
router.get('/blogs', directoryCache, getBlogs);
router.get('/blogs/:id', directoryCache, getById('blog'));
router.get('/faqs', masterCache, getFaqs);
router.get('/testimonials', masterCache, getTestimonials);
router.post('/contact', submitContact);
router.get('/search', directoryCache, search);

export default router;
