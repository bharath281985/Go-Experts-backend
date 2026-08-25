import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { createReport, listReports, updateReportStatus } from "../../controllers/support/support.controller.js";
import { createTicket, listUserTickets, getTicket, addTicketMessage, updateTicketStatus } from "../../controllers/support/support-ticket.controller.js";

const router = Router();

router.use(authMiddleware);

// User endpoints
router.post("/reports", createReport as any);

// Help & Support Ticket Endpoints (User Side)
router.post("/tickets", createTicket as any);
router.get("/tickets", listUserTickets as any);
router.get("/tickets/:id", getTicket as any);
router.post("/tickets/:id/messages", addTicketMessage as any);
router.patch("/tickets/:id/status", updateTicketStatus as any);
// Admin endpoints
router.get("/reports", listReports as any);
router.patch("/reports/:id/status", updateReportStatus as any);

export default router;
