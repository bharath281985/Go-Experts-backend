import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { getIo } from "../../socket/index.js";

// 1. List All Tickets (Admin)
export const listAdminTickets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, priority, categoryId, search, page = "1", pageSize = "20" } = req.query;
    
    const where: any = {};
    if (status) where.status = String(status).toUpperCase();
    if (priority) where.priority = String(priority);
    if (categoryId) where.categoryId = String(categoryId);
    
    if (search) {
      const q = String(search);
      where.OR = [
        { ticketNumber: { contains: q } },
        { subject: { contains: q } },
        { requesterId: { contains: q } }
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" } }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    res.json({
      success: true,
      data: tickets,
      items: tickets,
      total,
      page: Number(page),
      pageSize: take
    });
  } catch (err) {
    next(err);
  }
};

// 2. Get Single Ticket Details
export const getAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" } // Admins see internal notes as well
        }
      }
    });

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    res.json({ success: true, ticket, data: ticket });
  } catch (err) {
    next(err);
  }
};

// 3. Update Ticket (Status/Priority)
export const updateAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === "RESOLVED") data.resolvedAt = new Date();
      if (status === "CLOSED") data.closedAt = new Date();
    }
    if (priority) data.priority = priority;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data
    });

    // Notify user via socket
    const io = getIo();
    if (io) {
      io.to(`support-ticket:${id}`).emit("support:ticket:updated", ticket);
    }

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 4. Assign Ticket
export const assignAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { assignedToId }
    });

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 5. Add Message (Public reply or Internal Note)
export const addAdminTicketMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { message, isInternal } = req.body;

    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const newMessage = await prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderId: adminId,
        senderRole: "admin",
        message,
        isInternal: Boolean(isInternal)
      }
    });

    // If it's a public reply, update ticket status
    if (!isInternal) {
      await prisma.supportTicket.update({
        where: { id },
        data: { 
          status: "WAITING_FOR_USER",
          firstResponseAt: new Date()
        }
      });
    }

    // Emit to user's socket room in real-time
    const io = getIo();
    if (io && !isInternal) {
      io.to(`support-ticket:${id}`).emit("support:message:new", newMessage);
    }

    res.json({ success: true, message: newMessage });
  } catch (err) {
    next(err);
  }
};

