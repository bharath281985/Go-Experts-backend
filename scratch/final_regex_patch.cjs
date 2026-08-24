const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Replace model ends with the new fields included.
s = s.replace(/model ClientProfile \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  invitations Invitation[]\\n  shortlists Shortlist[]\\n}');
});

s = s.replace(/model FreelancerProfile \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  invitations Invitation[]\\n  shortlists Shortlist[]\\n}');
});

s = s.replace(/model Project \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  invitations Invitation[]\\n  shortlists Shortlist[]\\n}');
});

s = s.replace(/model Proposal \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  offers Offer[]\\n}');
});

s = s.replace(/model Message \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  clientMessageId String? @map("client_message_id")\\n  replyToId String? @map("reply_to_id")\\n  deliveryStatus String @default("SENT") @map("delivery_status")\\n  deletedAt DateTime? @map("deleted_at")\\n  replyTo Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)\\n  replies Message[] @relation("MessageReplies")\\n  reactions MessageReaction[]\\n}');
});

s = s.replace(/model Conversation \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  contextType String? @map("context_type")\\n  investmentId String? @map("investment_id")\\n  startupIdeaId String? @map("startup_idea_id")\\n  supportTicketId String? @map("support_ticket_id")\\n  states ConversationState[]\\n}');
});

s = s.replace(/model User \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  reactions MessageReaction[]\\n  conversationStates ConversationState[]\\n  reports Report[] @relation("Reporter")\\n  reported Report[] @relation("ReportedUser")\\n}');
});

s = s.replace(/model AuditLog \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  adminId String? @map("admin_id")\\n}');
});

s = s.replace(/model Notification \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  count Int @default(1)\\n  actorId String? @map("actor_id")\\n  contextType String? @map("context_type")\\n  contextId String? @map("context_id")\\n  actionUrl String? @map("action_url")\\n}');
});


fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema perfectly patched with regex replace on model strings!');
