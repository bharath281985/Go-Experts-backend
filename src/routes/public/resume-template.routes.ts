import { Router } from "express";
import { getPublicResumeTemplates, getResumeRenderData } from "../../controllers/public/resume-template.controller";

const publicResumeTemplateRouter = Router();

publicResumeTemplateRouter.get("/", getPublicResumeTemplates);
publicResumeTemplateRouter.get("/render/:token", getResumeRenderData as any);

export default publicResumeTemplateRouter;
