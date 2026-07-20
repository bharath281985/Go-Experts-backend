/**
 * Socket.IO realtime messaging.
 *
 * Auth: JWT from handshake.auth.token or Authorization Bearer header (JWT_SECRET).
 * Rooms: user:{userId}, conversation:{conversationId}
 * Events: message:send, message:new, typing:start, typing:stop, presence:online
 */
import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";

let io: Server | null = null;

interface SocketUser {
  id: string;
  email: string;
  role: string;
  type?: "admin" | "portal";
}

function extractToken(socket: Socket): string | null {
  const authToken = (socket.handshake.auth as any)?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.startsWith("Bearer ") ? authToken.slice(7) : authToken;
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error("Authentication required"));
      const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser & { type?: "admin" | "portal" };
      (socket as any).user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        type: decoded.type,
      } as SocketUser;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as SocketUser;
    if (!user?.id) {
      socket.disconnect(true);
      return;
    }

    const userRoom = `user:${user.id}`;
    socket.join(userRoom);
    socket.emit("presence:online", { userId: user.id, online: true });
    socket.to(userRoom).emit("presence:online", { userId: user.id, online: true });

    socket.on("presence:online", () => {
      socket.emit("presence:online", { userId: user.id, online: true });
      if (io) io.to(userRoom).emit("presence:online", { userId: user.id, online: true });
    });

    socket.on(
      "message:send",
      async (payload: { conversationId: string; text: string; from?: string }, ack?: (res: unknown) => void) => {
        try {
          const conversationId = payload?.conversationId;
          const text = payload?.text;
          if (!conversationId || !text) {
            ack?.({ success: false, message: "conversationId and text required" });
            return;
          }

          const room = `conversation:${conversationId}`;
          socket.join(room);

          let message: any = null;
          try {
            const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
            if (conversation) {
              const nowLabel = new Date().toLocaleTimeString();
              message = await prisma.message.create({
                data: {
                  conversationId,
                  from: payload.from || "me",
                  text,
                  time: nowLabel,
                },
              });
              await prisma.conversation.update({
                where: { id: conversationId },
                data: { msg: text, time: nowLabel },
              });
            }
          } catch (persistErr) {
            console.warn("Socket message persist skipped:", (persistErr as Error).message);
          }

          const outbound = {
            conversationId,
            text,
            from: payload.from || user.id,
            userId: user.id,
            message,
            createdAt: new Date().toISOString(),
          };

          if (io) io.to(room).emit("message:new", outbound);
          ack?.({ success: true, data: outbound });
        } catch (e: any) {
          ack?.({ success: false, message: e.message });
        }
      }
    );

    socket.on("typing:start", (payload: { conversationId: string }) => {
      if (!payload?.conversationId) return;
      const room = `conversation:${payload.conversationId}`;
      socket.join(room);
      socket.to(room).emit("typing:start", { conversationId: payload.conversationId, userId: user.id });
    });

    socket.on("typing:stop", (payload: { conversationId: string }) => {
      if (!payload?.conversationId) return;
      const room = `conversation:${payload.conversationId}`;
      socket.to(room).emit("typing:stop", { conversationId: payload.conversationId, userId: user.id });
    });

    socket.on("disconnect", () => {
      if (io) io.to(userRoom).emit("presence:online", { userId: user.id, online: false });
    });
  });

  console.log("Socket.IO initialized");
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized. Call initSocket(httpServer) first.");
  return io;
}
