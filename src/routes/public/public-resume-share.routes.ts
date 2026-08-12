import { Router } from "express";
import { getSharedResume, exportSharedResumePdf } from "../../controllers/public/public-resume-share.controller.js";

const publicResumeShareRouter = Router();

publicResumeShareRouter.get("/:token", getSharedResume as any);
publicResumeShareRouter.post("/:token/pdf", exportSharedResumePdf as any);

export default publicResumeShareRouter;
