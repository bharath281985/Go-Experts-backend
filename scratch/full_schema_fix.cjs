const fs = require('fs');

let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Remove old Referral models
s = s.replace(/model Referral \{[\s\S]*?\n\}\n*/, '');
s = s.replace(/model ReferralReward \{[\s\S]*?\n\}\n*/, '');

// 2. Add inverse relations to existing models
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
  return match.replace(/\n\}/, '\\n  projectId String? @map("project_id")\\n  adminNote String? @map("admin_note") @db.Text\\n  project Project? @relation(fields: [projectId], references: [id])\\n  contextType String? @map("context_type")\\n  investmentId String? @map("investment_id")\\n  startupIdeaId String? @map("startup_idea_id")\\n  supportTicketId String? @map("support_ticket_id")\\n  states ConversationState[]\\n}');
});

s = s.replace(/model User \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  referralCode String? @unique @map("referral_code")\\n  reactions MessageReaction[]\\n  conversationStates ConversationState[]\\n  reports Report[] @relation("Reporter")\\n  reported Report[] @relation("ReportedUser")\\n  referralsMade Referral[] @relation("Referrer")\\n  referralsReceived Referral[] @relation("Referee")\\n}');
});

s = s.replace(/model AuditLog \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  entityType String? @map("entity_type")\\n  adminId String? @map("admin_id")\\n}');
});

s = s.replace(/model Notification \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\\n  count Int @default(1)\\n  actorId String? @map("actor_id")\\n  contextType String? @map("context_type")\\n  contextId String? @map("context_id")\\n  actionUrl String? @map("action_url")\\n}');
});

// 3. Append missing models
const newModels = [
"",
"model Invitation {",
"  id           String    @id @default(uuid())",
"  projectId    String    @map('project_id')",
"  clientId     String    @map('client_id')",
"  freelancerId String    @map('freelancer_id')",
"  status       String    @default('DRAFT')",
"  message      String?",
"  expiresAt    DateTime? @map('expires_at')",
"  createdAt    DateTime  @default(now()) @map('created_at')",
"  respondedAt  DateTime? @map('responded_at')",
"  updatedAt    DateTime  @updatedAt @map('updated_at')",
"  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)",
"  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)",
"  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)",
"  @@index([clientId])",
"  @@index([freelancerId])",
"  @@index([projectId])",
"  @@map('invitations')",
"}",
"",
"model Shortlist {",
"  id           String   @id @default(uuid())",
"  projectId    String   @map('project_id')",
"  clientId     String   @map('client_id')",
"  freelancerId String   @map('freelancer_id')",
"  createdAt    DateTime @default(now()) @map('created_at')",
"  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)",
"  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)",
"  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)",
"  @@unique([projectId, freelancerId])",
"  @@index([clientId])",
"  @@map('shortlists')",
"}",
"",
"model Offer {",
"  id         String   @id @default(uuid())",
"  proposalId String   @map('proposal_id')",
"  amount     Float",
"  timeline   String?",
"  terms      String?  @db.Text",
"  status     String   @default('PENDING')",
"  createdAt  DateTime @default(now()) @map('created_at')",
"  updatedAt  DateTime @updatedAt @map('updated_at')",
"  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)",
"  @@index([proposalId])",
"  @@map('offers')",
"}",
"",
"model MessageReaction {",
"  id        String   @id @default(uuid())",
"  messageId String   @map('message_id')",
"  userId    String   @map('user_id')",
"  reaction  String",
"  createdAt DateTime @default(now()) @map('created_at')",
"  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)",
"  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)",
"  @@unique([messageId, userId, reaction])",
"  @@map('message_reactions')",
"}",
"",
"model ConversationState {",
"  id             String    @id @default(uuid())",
"  userId         String    @map('user_id')",
"  conversationId String    @map('conversation_id')",
"  isPinned       Boolean   @default(false) @map('is_pinned')",
"  isMuted        Boolean   @default(false) @map('is_muted')",
"  isArchived     Boolean   @default(false) @map('is_archived')",
"  lastReadAt     DateTime? @map('last_read_at')",
"  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)",
"  user User @relation(fields: [userId], references: [id], onDelete: Cascade)",
"  @@unique([userId, conversationId])",
"  @@map('conversation_states')",
"}",
"",
"model BusinessActivity {",
"  id          String   @id @default(uuid())",
"  type        String",
"  contextType String?  @map('context_type')",
"  contextId   String?  @map('context_id')",
"  actorId     String?  @map('actor_id')",
"  actorType   String   @default('USER') @map('actor_type')",
"  metadata    String?  @db.Text",
"  createdAt   DateTime @default(now()) @map('created_at')",
"  @@index([contextType, contextId])",
"  @@map('business_activities')",
"}",
"",
"model Report {",
"  id             String   @id @default(uuid())",
"  reporterId     String   @map('reporter_id')",
"  reportedUserId String?  @map('reported_user_id')",
"  conversationId String?  @map('conversation_id')",
"  messageId      String?  @map('message_id')",
"  reason         String   @db.Text",
"  status         String   @default('PENDING')",
"  createdAt      DateTime @default(now()) @map('created_at')",
"  updatedAt      DateTime @updatedAt @map('updated_at')",
"  reporter     User  @relation('Reporter', fields: [reporterId], references: [id], onDelete: Cascade)",
"  reportedUser User? @relation('ReportedUser', fields: [reportedUserId], references: [id], onDelete: SetNull)",
"  @@map('reports')",
"}",
"",
"model ReferralCampaign {",
"  id String @id @default(uuid())",
"  name String",
"  status String @default('ACTIVE')",
"  rewardType String",
"  rules ReferralRule[]",
"  referrals Referral[]",
"  clicks ReferralClick[]",
"  createdAt DateTime @default(now())",
"  updatedAt DateTime @updatedAt",
"  @@map('referral_campaigns')",
"}",
"",
"model ReferralRule {",
"  id String @id @default(uuid())",
"  campaignId String",
"  qualification String",
"  rewardAmount Float",
"  campaign ReferralCampaign @relation(fields: [campaignId], references: [id])",
"  @@map('referral_rules')",
"}",
"",
"model ReferralClick {",
"  id String @id @default(uuid())",
"  campaignId String?",
"  referrerId String?",
"  ipAddress String?",
"  userAgent String?",
"  createdAt DateTime @default(now())",
"  campaign ReferralCampaign? @relation(fields: [campaignId], references: [id])",
"  @@map('referral_clicks')",
"}",
"",
"model Referral {",
"  id         String           @id @default(uuid())",
"  campaignId String?",
"  referrerId String           @map('referrer_id')",
"  refereeId  String           @unique @map('referee_id')",
"  link       String?",
"  qrCode     String?          @map('qr_code')",
"  status     String           @default('pending')",
"  createdAt  DateTime         @default(now()) @map('created_at')",
"  updatedAt  DateTime         @updatedAt @map('updated_at')",
"  events     ReferralEvent[]",
"  rewards    ReferralReward[]",
"  campaign   ReferralCampaign? @relation(fields: [campaignId], references: [id])",
"  referee    User             @relation('Referee', fields: [refereeId], references: [id], onDelete: Cascade)",
"  referrer   User             @relation('Referrer', fields: [referrerId], references: [id], onDelete: Cascade)",
"  @@index([referrerId], map: 'referrals_referrer_id_fkey')",
"  @@map('referrals')",
"}",
"",
"model ReferralEvent {",
"  id String @id @default(uuid())",
"  referralId String",
"  eventType String",
"  metadata String? @db.Text",
"  referral Referral @relation(fields: [referralId], references: [id])",
"  createdAt DateTime @default(now())",
"  @@map('referral_events')",
"}",
"",
"model ReferralReward {",
"  id         String   @id @default(uuid())",
"  referralId String   @map('referral_id')",
"  amount     Float?",
"  points     Int      @default(0)",
"  status     String   @default('PENDING')",
"  createdAt  DateTime @default(now())",
"  referral Referral @relation(fields: [referralId], references: [id])",
"  @@map('referral_rewards')",
"}"
].join('\\n').replace(/'/g, '"');

s += '\\n' + newModels + '\\n';

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema perfectly completely rewritten with all dependencies!');
