import { prisma } from '../../config/database.js';
import { emitConversationMessage } from './socket-emit.js';

/** Notify conversation peers after a message is persisted. */
export const notifyNewMessage = async (
  conversationId: string,
  message: Record<string, unknown>
) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) return;
    await emitConversationMessage(conversation, message);
  } catch {
    /* realtime is best-effort */
  }
};
