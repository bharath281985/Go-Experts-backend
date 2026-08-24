const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Notification
s = s.replace(
  /model Notification \{[\s\S]*?\@\@map\("notifications"\)\n\}/,
  'model Notification {\n' +
  '  id               String                        @id @default(uuid())\n' +
  '  userId           String?                       @map("user_id")\n' +
  '  role             String?\n' +
  '  type             String\n' +
  '  title            String\n' +
  '  message          String\n' +
  '  channel          String\n' +
  '  priority         String                        @default("normal")\n' +
  '  status           String                        @default("draft")\n' +
  '  \n' +
  '  count            Int                           @default(1)\n' +
  '  actorId          String?                       @map("actor_id")\n' +
  '  contextType      String?                       @map("context_type")\n' +
  '  contextId        String?                       @map("context_id")\n' +
  '  actionUrl        String?                       @map("action_url")\n' +
  '\n' +
  '  readAt           DateTime?                     @map("read_at")\n' +
  '  scheduledAt      DateTime?                     @map("scheduled_at")\n' +
  '  sentAt           DateTime?                     @map("sent_at")\n' +
  '  failedAt         DateTime?                     @map("failed_at")\n' +
  '  metadata         String?                       @map("metadata")\n' +
  '  createdAt        DateTime                      @default(now()) @map("created_at")\n' +
  '  updatedAt        DateTime                      @updatedAt @map("updated_at")\n' +
  '  deliveryAttempts NotificationDeliveryAttempt[]\n' +
  '  user             User?                         @relation(fields: [userId], references: [id], onDelete: Cascade)\n' +
  '\n' +
  '  @@index([userId])\n' +
  '  @@index([status])\n' +
  '  @@index([scheduledAt])\n' +
  '  @@map("notifications")\n' +
  '}'
);

// 2. Proposal
s = s.replace(
  /model Proposal \{[\s\S]*?\@\@map\("proposals"\)\n\}/,
  'model Proposal {\n' +
  '  id           String    @id @default(uuid())\n' +
  '  projectId    String    @map("project_id")\n' +
  '  freelancerId String    @map("freelancer_id")\n' +
  '  coverLetter  String    @map("cover_letter") @db.Text\n' +
  '  bidAmount    Float     @map("bid_amount")\n' +
  '  duration     String\n' +
  '  status       String    @default("pending")\n' +
  '  createdAt    DateTime  @default(now()) @map("created_at")\n' +
  '  updatedAt    DateTime  @updatedAt @map("updated_at")\n' +
  '  deletedAt    DateTime? @map("deleted_at")\n' +
  '  \n' +
  '  freelancer   User      @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\n' +
  '  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)\n' +
  '  offers       Offer[]\n' +
  '\n' +
  '  @@index([freelancerId], map: "proposals_freelancer_id_fkey")\n' +
  '  @@index([projectId], map: "proposals_project_id_fkey")\n' +
  '  @@map("proposals")\n' +
  '}'
);

// 3. Message
s = s.replace(
  /model Message \{[\s\S]*?\@\@map\("messages"\)\n\}/,
  'model Message {\n' +
  '  id             String   @id @default(uuid())\n' +
  '  conversationId String   @map("conversation_id")\n' +
  '  senderId       String   @map("sender_id")\n' +
  '  text           String   @db.Text\n' +
  '  time           String\n' +
  '  from           String\n' +
  '  attachmentUrl  String?  @map("attachment_url")\n' +
  '  readAt         DateTime? @map("read_at")\n' +
  '  \n' +
  '  clientMessageId String? @map("client_message_id")\n' +
  '  replyToId      String?  @map("reply_to_id")\n' +
  '  deliveryStatus String   @default("SENT") @map("delivery_status")\n' +
  '  deletedAt      DateTime? @map("deleted_at")\n' +
  '  \n' +
  '  createdAt      DateTime @default(now()) @map("created_at")\n' +
  '  updatedAt      DateTime @updatedAt @map("updated_at")\n' +
  '  \n' +
  '  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)\n' +
  '  sender         User         @relation(fields: [senderId], references: [id], onDelete: Cascade)\n' +
  '  \n' +
  '  replyTo        Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)\n' +
  '  replies        Message[] @relation("MessageReplies")\n' +
  '  reactions      MessageReaction[]\n' +
  '\n' +
  '  @@index([conversationId])\n' +
  '  @@index([senderId])\n' +
  '  @@map("messages")\n' +
  '}'
);

// 4. Conversation
s = s.replace(
  /model Conversation \{[\s\S]*?\@\@map\("conversations"\)\n\}/,
  'model Conversation {\n' +
  '  id           String    @id @default(uuid())\n' +
  '  projectId    String?\n' +
  '  \n' +
  '  contextType    String?  @map("context_type")\n' +
  '  investmentId   String?  @map("investment_id")\n' +
  '  startupIdeaId  String?  @map("startup_idea_id")\n' +
  '  supportTicketId String? @map("support_ticket_id")\n' +
  '  \n' +
  '  createdAt    DateTime  @default(now()) @map("created_at")\n' +
  '  updatedAt    DateTime  @updatedAt @map("updated_at")\n' +
  '  \n' +
  '  participants ConversationParticipant[]\n' +
  '  messages     Message[]\n' +
  '  states       ConversationState[]\n' +
  '\n' +
  '  @@map("conversations")\n' +
  '}'
);

// 5. AuditLog
s = s.replace(
  /model AuditLog \{[\s\S]*?\@\@map\("audit_logs"\)\n\}/,
  'model AuditLog {\n' +
  '  id         String   @id @default(uuid())\n' +
  '  userId     String?  @map("user_id")\n' +
  '  adminId    String?  @map("admin_id")\n' +
  '  action     String\n' +
  '  entityType String   @map("entity_type")\n' +
  '  entityId   String   @map("entity_id")\n' +
  '  details    String?  @db.Text\n' +
  '  ipAddress  String?  @map("ip_address")\n' +
  '  userAgent  String?  @map("user_agent")\n' +
  '  createdAt  DateTime @default(now()) @map("created_at")\n' +
  '\n' +
  '  @@index([entityType, entityId])\n' +
  '  @@index([userId])\n' +
  '  @@map("audit_logs")\n' +
  '}'
);

// 6. Append missing models
const missingModels = '\n' +
'model Invitation {\n' +
'  id           String    @id @default(uuid())\n' +
'  projectId    String    @map("project_id")\n' +
'  clientId     String    @map("client_id")\n' +
'  freelancerId String    @map("freelancer_id")\n' +
'  status       String    @default("DRAFT")\n' +
'  message      String?\n' +
'  expiresAt    DateTime? @map("expires_at")\n' +
'  createdAt    DateTime  @default(now()) @map("created_at")\n' +
'  respondedAt  DateTime? @map("responded_at")\n' +
'  updatedAt    DateTime  @updatedAt @map("updated_at")\n' +
'\n' +
'  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)\n' +
'  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\n' +
'  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)\n' +
'\n' +
'  @@index([clientId])\n' +
'  @@index([freelancerId])\n' +
'  @@index([projectId])\n' +
'  @@map("invitations")\n' +
'}\n' +
'\n' +
'model Shortlist {\n' +
'  id           String   @id @default(uuid())\n' +
'  projectId    String   @map("project_id")\n' +
'  clientId     String   @map("client_id")\n' +
'  freelancerId String   @map("freelancer_id")\n' +
'  createdAt    DateTime @default(now()) @map("created_at")\n' +
'\n' +
'  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)\n' +
'  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\n' +
'  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)\n' +
'\n' +
'  @@unique([projectId, freelancerId])\n' +
'  @@index([clientId])\n' +
'  @@map("shortlists")\n' +
'}\n' +
'\n' +
'model Offer {\n' +
'  id         String   @id @default(uuid())\n' +
'  proposalId String   @map("proposal_id")\n' +
'  amount     Float\n' +
'  timeline   String?\n' +
'  terms      String?  @db.Text\n' +
'  status     String   @default("PENDING")\n' +
'  createdAt  DateTime @default(now()) @map("created_at")\n' +
'  updatedAt  DateTime @updatedAt @map("updated_at")\n' +
'\n' +
'  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)\n' +
'\n' +
'  @@index([proposalId])\n' +
'  @@map("offers")\n' +
'}\n' +
'\n' +
'model MessageReaction {\n' +
'  id        String   @id @default(uuid())\n' +
'  messageId String   @map("message_id")\n' +
'  userId    String   @map("user_id")\n' +
'  reaction  String\n' +
'  createdAt DateTime @default(now()) @map("created_at")\n' +
'\n' +
'  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)\n' +
'  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)\n' +
'\n' +
'  @@unique([messageId, userId, reaction])\n' +
'  @@map("message_reactions")\n' +
'}\n' +
'\n' +
'model ConversationState {\n' +
'  id             String    @id @default(uuid())\n' +
'  userId         String    @map("user_id")\n' +
'  conversationId String    @map("conversation_id")\n' +
'  isPinned       Boolean   @default(false) @map("is_pinned")\n' +
'  isMuted        Boolean   @default(false) @map("is_muted")\n' +
'  isArchived     Boolean   @default(false) @map("is_archived")\n' +
'  lastReadAt     DateTime? @map("last_read_at")\n' +
'\n' +
'  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)\n' +
'  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n' +
'\n' +
'  @@unique([userId, conversationId])\n' +
'  @@map("conversation_states")\n' +
'}\n' +
'\n' +
'model BusinessActivity {\n' +
'  id          String   @id @default(uuid())\n' +
'  type        String\n' +
'  contextType String?  @map("context_type")\n' +
'  contextId   String?  @map("context_id")\n' +
'  actorId     String?  @map("actor_id")\n' +
'  actorType   String   @default("USER") @map("actor_type")\n' +
'  metadata    String?  @db.Text\n' +
'  createdAt   DateTime @default(now()) @map("created_at")\n' +
'\n' +
'  @@index([contextType, contextId])\n' +
'  @@map("business_activities")\n' +
'}\n' +
'\n' +
'model Report {\n' +
'  id             String   @id @default(uuid())\n' +
'  reporterId     String   @map("reporter_id")\n' +
'  reportedUserId String?  @map("reported_user_id")\n' +
'  conversationId String?  @map("conversation_id")\n' +
'  messageId      String?  @map("message_id")\n' +
'  reason         String   @db.Text\n  status         String   @default("PENDING")\n' +
'  createdAt      DateTime @default(now()) @map("created_at")\n' +
'  updatedAt      DateTime @updatedAt @map("updated_at")\n' +
'\n' +
'  reporter     User  @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)\n' +
'  reportedUser User? @relation("ReportedUser", fields: [reportedUserId], references: [id], onDelete: SetNull)\n' +
'\n' +
'  @@map("reports")\n' +
'}\n';

if (!s.includes('model BusinessActivity')) {
  s += missingModels;
}

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema perfectly repaired!');
