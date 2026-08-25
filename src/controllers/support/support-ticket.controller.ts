import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { getIo } from "../../socket/index.js";

// Helper for SLA calculation
function getSlaDueAt(priority: string): Date {
  const now = new Date();
  switch (priority.toUpperCase()) {
    case "URGENT": now.setHours(now.getHours() + 1); break;
    case "HIGH": now.setHours(now.getHours() + 4); break;
    case "NORMAL": now.setHours(now.getHours() + 24); break;
    case "LOW": now.setHours(now.getHours() + 48); break;
    default: now.setHours(now.getHours() + 24); break; // Default to Normal
  }
  return now;
}

// Helper for dynamic AI welcome message
function getDynamicWelcomeMessage(role: string): string {
  switch (role.toLowerCase()) {
    case "freelancer":
      return "I'm happy to help you with your account, finding projects, submitting proposals, or anything else you may need - just type away and let me know!";
    case "client":
    case "business":
      return "I'm happy to help you with your account, finding freelancers, posting projects, or anything else you may need - just type away and let me know!";
    case "founder":
      return "I'm happy to help you with your account, finding investors, pitching, or anything else you may need - just type away and let me know!";
    case "investor":
      return "I'm happy to help you with your account, finding startups, deals, or anything else you may need - just type away and let me know!";
    default:
      return "I'm happy to help you with your account or anything else you may need - just type away and let me know!";
  }
}

// 1. Create a Ticket
export const createTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // The user's role might be in req.user.role, but sometimes clients pass it. Let's assume req.user.role exists, fallback to 'user'
    const role = (req.user as any)?.role || "user";
    // For Multi-tenant data, assume user has companyId.
    const companyId = (req.user as any)?.companyId || null;

    const { subject, categoryId, priority, message } = req.body;
    if (!subject || !categoryId || !message) {
      return res.status(400).json({ success: false, message: "Subject, category, and initial message are required" });
    }

    const ticketPriority = priority || "Normal";

    const ticket = await prisma.supportTicket.create({
      data: {
        requesterId: userId,
        requesterRole: role,
        subject,
        categoryId,
        priority: ticketPriority,
        status: "OPEN",
        companyId,
        slaDueAt: getSlaDueAt(ticketPriority),
        messages: {
          create: [
            {
              senderId: userId,
              senderRole: role,
              message,
              isInternal: false
            },
            // If it's a Live Chat Support ticket, automatically append an AI response
            ...(subject === "Live Chat Support" ? [{
              senderId: "system",
              senderRole: "support",
              message: getDynamicWelcomeMessage(role),
              isInternal: false
            }] : [])
          ]
        }
      },
      include: {
        messages: true
      }
    });

    // Emit socket event for the created ticket
    const io = getIo();
    if (io) {
      ticket.messages.forEach(msg => {
        io.to(`support-ticket:${ticket.id}`).emit('support:message:new', msg);
      });
      // Optionally notify admins
      io.to('admin').emit('support:ticket:new', ticket);
    }

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 2. List User's Tickets
export const listUserTickets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const tickets = await prisma.supportTicket.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, items: tickets, data: tickets }); // Support both data formats
  } catch (err) {
    next(err);
  }
};

// 3. Get Single Ticket
export const getTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          where: { isInternal: false } // Users shouldn't see internal notes
        }
      }
    });

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    // Multi-tenant check
    if (ticket.requesterId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 4. Add Message to Ticket (User side)
export const addTicketMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const ticket = await prisma.supportTicket.findUnique({ 
      where: { id },
      include: { messages: true }
    });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    if (ticket.requesterId !== userId) return res.status(403).json({ success: false, message: "Forbidden" });

    const role = (req.user as any)?.role || "user";

    const newMessage = await prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderId: userId,
        senderRole: role,
        message,
        isInternal: false
      }
    });

    let autoReplyMessage = null;
    // Industry level: If this is the user's first actual reply to the AI greeting (i.e., ticket has exactly 2 messages now: 1 user initial, 1 AI greeting. Wait, the creation has 2 messages. So this makes it 3.
    // Let's just check if there's no human agent in the chat yet.
    const hasAgentReplied = ticket.messages.some(m => m.senderRole === "admin" || (m.senderRole === "support" && m.senderId !== "system"));
    
    // If it's a Live Chat Support ticket and no agent has replied yet, send an auto-responder (only once)
    const userMessageCount = ticket.messages.filter(m => m.senderId === userId).length;
    if (ticket.subject === "Live Chat Support" && !hasAgentReplied && userMessageCount === 1) {
      autoReplyMessage = await prisma.supportTicketMessage.create({
        data: {
          ticketId: id,
          senderId: "system",
          senderRole: "support",
          message: "Thank you for the details. A support agent will connect with you shortly to assist you further.",
          isInternal: false
        }
      });
    }

    // Optionally update ticket status if it was waiting for user
    if (ticket.status === "WAITING_FOR_USER") {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: "OPEN" }
      });
    }

    // Emit socket event
    const io = getIo();
    if (io) {
      io.to(`support-ticket:${id}`).emit('support:message:new', newMessage);
      if (autoReplyMessage) {
        setTimeout(() => {
          io.to(`support-ticket:${id}`).emit('support:message:new', autoReplyMessage);
        }, 1000); // 1-second delay for realism
      }
    }

    res.json({ success: true, message: newMessage });
  } catch (err) {
    next(err);
  }
};

// 5. Update Ticket Status (User can only mark as RESOLVED generally)
export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body;

    if (status !== "RESOLVED") {
      return res.status(400).json({ success: false, message: "Users can only mark tickets as RESOLVED" });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    if (ticket.requesterId !== userId) return res.status(403).json({ success: false, message: "Forbidden" });

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { 
        status: "RESOLVED",
        resolvedAt: new Date()
      }
    });

    const io = getIo();
    if (io) {
      io.to(`support-ticket:${id}`).emit('support:ticket:updated', updated);
    }

    res.json({ success: true, ticket: updated });
  } catch (err) {
    next(err);
  }
};
