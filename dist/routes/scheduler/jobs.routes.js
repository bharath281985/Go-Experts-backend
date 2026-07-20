import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { listJobs, getJobDetails, createJob, updateJob, deleteJob, runJobImmediately, pauseJob, resumeJob, getJobHistory } from "../../controllers/scheduler/jobs.controller.js";
const router = Router();
router.use(authMiddleware);
// Job routes
router.get("/", listJobs);
router.get("/history", getJobHistory);
router.get("/:id", getJobDetails);
router.post("/", createJob);
router.put("/:id", updateJob);
router.delete("/:id", deleteJob);
// Operations
router.post("/:id/run", runJobImmediately);
router.post("/:id/pause", pauseJob);
router.post("/:id/resume", resumeJob);
export default router;
