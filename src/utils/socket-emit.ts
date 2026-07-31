import { getIo } from '../socket/index.js';

/** Best-effort realtime emit; never fails the REST request. */
export const emitToUsers = (userIds: string[], event: string, payload: unknown) => {
  try {
    const io = getIo();
    for (const id of userIds) {
      if (id) io.to(id).emit(event, payload);
    }
  } catch {
    /* Socket not initialized (e.g. during tests) */
  }
};

export const emitConversationMessage = async (
  conversation: { id: string; userA?: string | null; userB?: string | null },
  message: Record<string, unknown>
) => {
  const recipients = [conversation.userA, conversation.userB].filter(
    (id): id is string => !!id
  );
  const payload = {
    ...message,
    conversationId: conversation.id,
  };
  emitToUsers(recipients, 'message:new', payload);
  try {
    const io = getIo();
    io.to(`conversation:${conversation.id}`).emit('message:new', payload);
  } catch {
    /* ignore */
  }
};
