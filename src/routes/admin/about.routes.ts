import { Router } from "express";
import {
  getAdminAboutPage,
  saveAboutDraft,
  publishAboutChanges,
  getAboutRevisions,
  getAboutRevisionById,
  restoreAboutRevision,
} from "../../controllers/admin/about.controller.js";

const router = Router();

router.get("/", getAdminAboutPage);
router.put("/draft", saveAboutDraft);
router.post("/publish", publishAboutChanges);
router.get("/revisions", getAboutRevisions);
router.get("/revisions/:revisionId", getAboutRevisionById);
router.post("/revisions/:revisionId/restore", restoreAboutRevision);

export default router;
