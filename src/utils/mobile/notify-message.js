"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyNewMessage = void 0;
const db_js_1 = require("../config/db.js");
const socket_emit_js_1 = require("./socket-emit.js");
/** Notify conversation peers after a message is persisted. */
const notifyNewMessage = async (conversationId, message) => {
    try {
        const conversation = await db_js_1.prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation)
            return;
        await (0, socket_emit_js_1.emitConversationMessage)(conversation, message);
    }
    catch {
        /* realtime is best-effort */
    }
};
exports.notifyNewMessage = notifyNewMessage;
