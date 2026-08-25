import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { 
  listAdminTickets, 
  getAdminTicket, 
  updateAdminTicket, 
  assignAdminTicket, 
  addAdminTicketMessage 
} from "../../controllers/admin/support-desk.controller.js";

const router = Router();

// Protect all routes
router.use(authMiddleware as any);
router.use((req: any, res: any, next: any) => {
  if (req.user?.type !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });
  next();
});

router.get("/tickets", listAdminTickets as any);
router.get("/tickets/:id", getAdminTicket as any);
router.patch("/tickets/:id", updateAdminTicket as any);
router.patch("/tickets/:id/assign", assignAdminTicket as any);
router.post("/tickets/:id/messages", addAdminTicketMessage as any);

export default router;
