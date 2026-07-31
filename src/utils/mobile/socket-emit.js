"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitConversationMessage = exports.emitToUsers = void 0;
const index_js_1 = require("../socket/index.js");
/** Best-effort realtime emit; never fails the REST request. */
const emitToUsers = (userIds, event, payload) => {
    try {
        const io = (0, index_js_1.getIo)();
        for (const id of userIds) {
            if (id)
                io.to(id).emit(event, payload);
        }
    }
    catch {
        /* Socket not initialized (e.g. during tests) */
    }
};
exports.emitToUsers = emitToUsers;
const emitConversationMessage = async (conversation, message) => {
    const recipients = [conversation.userA, conversation.userB].filter((id) => !!id);
    const payload = {
        ...message,
        conversationId: conversation.id,
    };
    (0, exports.emitToUsers)(recipients, 'message:new', payload);
    try {
        const io = (0, index_js_1.getIo)();
        io.to(`conversation:${conversation.id}`).emit('message:new', payload);
    }
    catch {
        /* ignore */
    }
};
exports.emitConversationMessage = emitConversationMessage;
