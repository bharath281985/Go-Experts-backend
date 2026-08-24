const fs = require('fs');

let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

if (!s.includes('model BusinessActivity')) {
  s += '\\nmodel Invitation {\\n  id String @id @default(uuid())\\n  projectId String @map("project_id")\\n  clientId String @map("client_id")\\n  freelancerId String @map("freelancer_id")\\n  status String @default("DRAFT")\\n  message String?\\n  expiresAt DateTime? @map("expires_at")\\n  createdAt DateTime @default(now()) @map("created_at")\\n  respondedAt DateTime? @map("responded_at")\\n  updatedAt DateTime @updatedAt @map("updated_at")\\n  client ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)\\n  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\\n  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)\\n  @@index([clientId])\\n  @@index([freelancerId])\\n  @@index([projectId])\\n  @@map("invitations")\\n}';
  
  s += '\\nmodel Shortlist {\\n  id String @id @default(uuid())\\n  projectId String @map("project_id")\\n  clientId String @map("client_id")\\n  freelancerId String @map("freelancer_id")\\n  createdAt DateTime @default(now()) @map("created_at")\\n  client ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)\\n  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\\n  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)\\n  @@unique([projectId, freelancerId])\\n  @@index([clientId])\\n  @@map("shortlists")\\n}';
  
  s += '\\nmodel Offer {\\n  id String @id @default(uuid())\\n  proposalId String @map("proposal_id")\\n  amount Float\\n  timeline String?\\n  terms String? @db.Text\\n  status String @default("PENDING")\\n  createdAt DateTime @default(now()) @map("created_at")\\n  updatedAt DateTime @updatedAt @map("updated_at")\\n  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)\\n  @@index([proposalId])\\n  @@map("offers")\\n}';
  
  s += '\\nmodel MessageReaction {\\n  id String @id @default(uuid())\\n  messageId String @map("message_id")\\n  userId String @map("user_id")\\n  reaction String\\n  createdAt DateTime @default(now()) @map("created_at")\\n  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)\\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\\n  @@unique([messageId, userId, reaction])\\n  @@map("message_reactions")\\n}';
  
  s += '\\nmodel ConversationState {\\n  id String @id @default(uuid())\\n  userId String @map("user_id")\\n  conversationId String @map("conversation_id")\\n  isPinned Boolean @default(false) @map("is_pinned")\\n  isMuted Boolean @default(false) @map("is_muted")\\n  isArchived Boolean @default(false) @map("is_archived")\\n  lastReadAt DateTime? @map("last_read_at")\\n  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)\\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\\n  @@unique([userId, conversationId])\\n  @@map("conversation_states")\\n}';
  
  s += '\\nmodel BusinessActivity {\\n  id String @id @default(uuid())\\n  type String\\n  contextType String? @map("context_type")\\n  contextId String? @map("context_id")\\n  actorId String? @map("actor_id")\\n  actorType String @default("USER") @map("actor_type")\\n  metadata String? @db.Text\\n  createdAt DateTime @default(now()) @map("created_at")\\n  @@index([contextType, contextId])\\n  @@map("business_activities")\\n}';
  
  s += '\\nmodel Report {\\n  id String @id @default(uuid())\\n  reporterId String @map("reporter_id")\\n  reportedUserId String? @map("reported_user_id")\\n  conversationId String? @map("conversation_id")\\n  messageId String? @map("message_id")\\n  reason String @db.Text\\n  status String @default("PENDING")\\n  createdAt DateTime @default(now()) @map("created_at")\\n  updatedAt DateTime @updatedAt @map("updated_at")\\n  reporter User @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)\\n  reportedUser User? @relation("ReportedUser", fields: [reportedUserId], references: [id], onDelete: SetNull)\\n  @@map("reports")\\n}';
  
  // Relations updates
  s = s.replace('freelancer   User      @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\\n  project', 'freelancer   User      @relation(fields: [freelancerId], references: [id], onDelete: Cascade)\\n  offers       Offer[]\\n  project');
  s = s.replace('userId     String?  @map("user_id")\\n  action', 'userId     String?  @map("user_id")\\n  adminId    String?  @map("admin_id")\\n  action');
  
  s = s.replace('projectId    String?\\n\\n  participants', 'projectId    String?\\n  contextType    String?  @map("context_type")\\n  investmentId   String?  @map("investment_id")\\n  startupIdeaId  String?  @map("startup_idea_id")\\n  supportTicketId String? @map("support_ticket_id")\\n  states ConversationState[]\\n\\n  participants');
  
  s = s.replace('createdAt      DateTime                      @default(now()) @map("created_at")', 'clientMessageId String? @map("client_message_id")\\n  replyToId      String?  @map("reply_to_id")\\n  deliveryStatus String   @default("SENT") @map("delivery_status")\\n  deletedAt      DateTime? @map("deleted_at")\\n  replyTo        Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)\\n  replies        Message[] @relation("MessageReplies")\\n  reactions      MessageReaction[]\\n\\n  createdAt      DateTime                      @default(now()) @map("created_at")');
  
  s = s.replace('status           String                        @default("draft")\\n  readAt', 'status           String                        @default("draft")\\n  count       Int       @default(1)\\n  actorId     String?   @map("actor_id")\\n  contextType String?   @map("context_type")\\n  contextId   String?   @map("context_id")\\n  actionUrl   String?   @map("action_url")\\n  readAt');
  
  fs.writeFileSync('prisma/schema.prisma', s);
}
