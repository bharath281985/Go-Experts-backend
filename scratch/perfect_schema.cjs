const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Notification
s = s.replace(
  /model Notification \{[\s\S]*?\@\@map\("notifications"\)\n\}/,
  \`model Notification {
  id               String                        @id @default(uuid())
  userId           String?                       @map("user_id")
  role             String?
  type             String
  title            String
  message          String
  channel          String
  priority         String                        @default("normal")
  status           String                        @default("draft")
  
  count            Int                           @default(1)
  actorId          String?                       @map("actor_id")
  contextType      String?                       @map("context_type")
  contextId        String?                       @map("context_id")
  actionUrl        String?                       @map("action_url")

  readAt           DateTime?                     @map("read_at")
  scheduledAt      DateTime?                     @map("scheduled_at")
  sentAt           DateTime?                     @map("sent_at")
  failedAt         DateTime?                     @map("failed_at")
  metadata         String?                       @map("metadata")
  createdAt        DateTime                      @default(now()) @map("created_at")
  updatedAt        DateTime                      @updatedAt @map("updated_at")
  deliveryAttempts NotificationDeliveryAttempt[]
  user             User?                         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([scheduledAt])
  @@map("notifications")
}\`
);

// 2. Proposal
s = s.replace(
  /model Proposal \{[\s\S]*?\@\@map\("proposals"\)\n\}/,
  \`model Proposal {
  id           String    @id @default(uuid())
  projectId    String    @map("project_id")
  freelancerId String    @map("freelancer_id")
  coverLetter  String    @map("cover_letter") @db.Text
  bidAmount    Float     @map("bid_amount")
  duration     String
  status       String    @default("pending")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")
  
  freelancer   User      @relation(fields: [freelancerId], references: [id], onDelete: Cascade)
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  offers       Offer[]

  @@index([freelancerId], map: "proposals_freelancer_id_fkey")
  @@index([projectId], map: "proposals_project_id_fkey")
  @@map("proposals")
}\`
);

// 3. Message
s = s.replace(
  /model Message \{[\s\S]*?\@\@map\("messages"\)\n\}/,
  \`model Message {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  senderId       String   @map("sender_id")
  text           String   @db.Text
  time           String
  from           String
  attachmentUrl  String?  @map("attachment_url")
  readAt         DateTime? @map("read_at")
  
  clientMessageId String? @map("client_message_id")
  replyToId      String?  @map("reply_to_id")
  deliveryStatus String   @default("SENT") @map("delivery_status")
  deletedAt      DateTime? @map("deleted_at")
  
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id], onDelete: Cascade)
  
  replyTo        Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies        Message[] @relation("MessageReplies")
  reactions      MessageReaction[]

  @@index([conversationId])
  @@index([senderId])
  @@map("messages")
}\`
);

// 4. Conversation
s = s.replace(
  /model Conversation \{[\s\S]*?\@\@map\("conversations"\)\n\}/,
  \`model Conversation {
  id           String    @id @default(uuid())
  projectId    String?
  
  contextType    String?  @map("context_type")
  investmentId   String?  @map("investment_id")
  startupIdeaId  String?  @map("startup_idea_id")
  supportTicketId String? @map("support_ticket_id")
  
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  
  participants ConversationParticipant[]
  messages     Message[]
  states       ConversationState[]

  @@map("conversations")
}\`
);

// 5. AuditLog
s = s.replace(
  /model AuditLog \{[\s\S]*?\@\@map\("audit_logs"\)\n\}/,
  \`model AuditLog {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")
  adminId    String?  @map("admin_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  details    String?  @db.Text
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([userId])
  @@map("audit_logs")
}\`
);


// 6. Append missing models
const missingModels = \`
model Invitation {
  id           String    @id @default(uuid())
  projectId    String    @map("project_id")
  clientId     String    @map("client_id")
  freelancerId String    @map("freelancer_id")
  status       String    @default("DRAFT")
  message      String?
  expiresAt    DateTime? @map("expires_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  respondedAt  DateTime? @map("responded_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([freelancerId])
  @@index([projectId])
  @@map("invitations")
}

model Shortlist {
  id           String   @id @default(uuid())
  projectId    String   @map("project_id")
  clientId     String   @map("client_id")
  freelancerId String   @map("freelancer_id")
  createdAt    DateTime @default(now()) @map("created_at")

  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, freelancerId])
  @@index([clientId])
  @@map("shortlists")
}

model Offer {
  id         String   @id @default(uuid())
  proposalId String   @map("proposal_id")
  amount     Float
  timeline   String?
  terms      String?  @db.Text
  status     String   @default("PENDING")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  @@index([proposalId])
  @@map("offers")
}

model MessageReaction {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  userId    String   @map("user_id")
  reaction  String
  createdAt DateTime @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, reaction])
  @@map("message_reactions")
}

model ConversationState {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  conversationId String    @map("conversation_id")
  isPinned       Boolean   @default(false) @map("is_pinned")
  isMuted        Boolean   @default(false) @map("is_muted")
  isArchived     Boolean   @default(false) @map("is_archived")
  lastReadAt     DateTime? @map("last_read_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, conversationId])
  @@map("conversation_states")
}

model BusinessActivity {
  id          String   @id @default(uuid())
  type        String
  contextType String?  @map("context_type")
  contextId   String?  @map("context_id")
  actorId     String?  @map("actor_id")
  actorType   String   @default("USER") @map("actor_type")
  metadata    String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([contextType, contextId])
  @@map("business_activities")
}

model Report {
  id             String   @id @default(uuid())
  reporterId     String   @map("reporter_id")
  reportedUserId String?  @map("reported_user_id")
  conversationId String?  @map("conversation_id")
  messageId      String?  @map("message_id")
  reason         String   @db.Text
  status         String   @default("PENDING")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  reporter     User  @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)
  reportedUser User? @relation("ReportedUser", fields: [reportedUserId], references: [id], onDelete: SetNull)

  @@map("reports")
}
\`;

if (!s.includes('model BusinessActivity')) {
  s += missingModels;
}

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema perfectly repaired!');
