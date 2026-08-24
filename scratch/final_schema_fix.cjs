const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// The replacement script
let lines = schema.split('\\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.trim() === '@@map("users")') {
    newLines.push('  reactions MessageReaction[]');
    newLines.push('  conversationStates ConversationState[]');
    newLines.push('  reports Report[] @relation("Reporter")');
    newLines.push('  reported Report[] @relation("ReportedUser")');
  }

  if (line.trim() === '@@map("client_profiles")') {
    newLines.push('  invitations Invitation[]');
    newLines.push('  shortlists Shortlist[]');
  }

  if (line.trim() === '@@map("freelancer_profiles")') {
    newLines.push('  invitations Invitation[]');
    newLines.push('  shortlists Shortlist[]');
  }

  if (line.trim() === '@@map("projects")') {
    newLines.push('  invitations Invitation[]');
    newLines.push('  shortlists Shortlist[]');
  }

  if (line.trim() === '@@map("proposals")') {
    newLines.push('  offers Offer[]');
  }

  if (line.trim() === '@@map("messages")') {
    newLines.push('  clientMessageId String? @map("client_message_id")');
    newLines.push('  replyToId String? @map("reply_to_id")');
    newLines.push('  deliveryStatus String @default("SENT") @map("delivery_status")');
    newLines.push('  deletedAt DateTime? @map("deleted_at")');
    newLines.push('  replyTo Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)');
    newLines.push('  replies Message[] @relation("MessageReplies")');
    newLines.push('  reactions MessageReaction[]');
  }

  if (line.trim() === '@@map("conversations")') {
    newLines.push('  contextType String? @map("context_type")');
    newLines.push('  investmentId String? @map("investment_id")');
    newLines.push('  startupIdeaId String? @map("startup_idea_id")');
    newLines.push('  supportTicketId String? @map("support_ticket_id")');
    newLines.push('  states ConversationState[]');
  }

  if (line.trim() === '@@map("audit_logs")') {
    newLines.push('  adminId String? @map("admin_id")');
  }

  if (line.trim() === '@@map("notifications")') {
    newLines.push('  count Int @default(1)');
    newLines.push('  actorId String? @map("actor_id")');
    newLines.push('  contextType String? @map("context_type")');
    newLines.push('  contextId String? @map("context_id")');
    newLines.push('  actionUrl String? @map("action_url")');
  }

  newLines.push(line);
}

const appendedModels = [
  "",
  "model Invitation {",
  "  id           String    @id @default(uuid())",
  "  projectId    String    @map(\"project_id\")",
  "  clientId     String    @map(\"client_id\")",
  "  freelancerId String    @map(\"freelancer_id\")",
  "  status       String    @default(\"DRAFT\")",
  "  message      String?",
  "  expiresAt    DateTime? @map(\"expires_at\")",
  "  createdAt    DateTime  @default(now()) @map(\"created_at\")",
  "  respondedAt  DateTime? @map(\"responded_at\")",
  "  updatedAt    DateTime  @updatedAt @map(\"updated_at\")",
  "",
  "  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)",
  "  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)",
  "  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)",
  "",
  "  @@index([clientId])",
  "  @@index([freelancerId])",
  "  @@index([projectId])",
  "  @@map(\"invitations\")",
  "}",
  "",
  "model Shortlist {",
  "  id           String   @id @default(uuid())",
  "  projectId    String   @map(\"project_id\")",
  "  clientId     String   @map(\"client_id\")",
  "  freelancerId String   @map(\"freelancer_id\")",
  "  createdAt    DateTime @default(now()) @map(\"created_at\")",
  "",
  "  client     ClientProfile     @relation(fields: [clientId], references: [id], onDelete: Cascade)",
  "  freelancer FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)",
  "  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)",
  "",
  "  @@unique([projectId, freelancerId])",
  "  @@index([clientId])",
  "  @@map(\"shortlists\")",
  "}",
  "",
  "model Offer {",
  "  id         String   @id @default(uuid())",
  "  proposalId String   @map(\"proposal_id\")",
  "  amount     Float",
  "  timeline   String?",
  "  terms      String?  @db.Text",
  "  status     String   @default(\"PENDING\")",
  "  createdAt  DateTime @default(now()) @map(\"created_at\")",
  "  updatedAt  DateTime @updatedAt @map(\"updated_at\")",
  "",
  "  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)",
  "",
  "  @@index([proposalId])",
  "  @@map(\"offers\")",
  "}",
  "",
  "model MessageReaction {",
  "  id        String   @id @default(uuid())",
  "  messageId String   @map(\"message_id\")",
  "  userId    String   @map(\"user_id\")",
  "  reaction  String",
  "  createdAt DateTime @default(now()) @map(\"created_at\")",
  "",
  "  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)",
  "  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)",
  "",
  "  @@unique([messageId, userId, reaction])",
  "  @@map(\"message_reactions\")",
  "}",
  "",
  "model ConversationState {",
  "  id             String    @id @default(uuid())",
  "  userId         String    @map(\"user_id\")",
  "  conversationId String    @map(\"conversation_id\")",
  "  isPinned       Boolean   @default(false) @map(\"is_pinned\")",
  "  isMuted        Boolean   @default(false) @map(\"is_muted\")",
  "  isArchived     Boolean   @default(false) @map(\"is_archived\")",
  "  lastReadAt     DateTime? @map(\"last_read_at\")",
  "",
  "  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)",
  "  user User @relation(fields: [userId], references: [id], onDelete: Cascade)",
  "",
  "  @@unique([userId, conversationId])",
  "  @@map(\"conversation_states\")",
  "}",
  "",
  "model BusinessActivity {",
  "  id          String   @id @default(uuid())",
  "  type        String",
  "  contextType String?  @map(\"context_type\")",
  "  contextId   String?  @map(\"context_id\")",
  "  actorId     String?  @map(\"actor_id\")",
  "  actorType   String   @default(\"USER\") @map(\"actor_type\")",
  "  metadata    String?  @db.Text",
  "  createdAt   DateTime @default(now()) @map(\"created_at\")",
  "",
  "  @@index([contextType, contextId])",
  "  @@map(\"business_activities\")",
  "}",
  "",
  "model Report {",
  "  id             String   @id @default(uuid())",
  "  reporterId     String   @map(\"reporter_id\")",
  "  reportedUserId String?  @map(\"reported_user_id\")",
  "  conversationId String?  @map(\"conversation_id\")",
  "  messageId      String?  @map(\"message_id\")",
  "  reason         String   @db.Text",
  "  status         String   @default(\"PENDING\")",
  "  createdAt      DateTime @default(now()) @map(\"created_at\")",
  "  updatedAt      DateTime @updatedAt @map(\"updated_at\")",
  "",
  "  reporter     User  @relation(\"Reporter\", fields: [reporterId], references: [id], onDelete: Cascade)",
  "  reportedUser User? @relation(\"ReportedUser\", fields: [reportedUserId], references: [id], onDelete: SetNull)",
  "",
  "  @@map(\"reports\")",
  "}"
];

// Append Models
let finalText = newLines.join('\\n');
if (!finalText.includes('model BusinessActivity')) {
  finalText += appendedModels.join('\\n');
}

fs.writeFileSync('prisma/schema.prisma', finalText);
console.log('Schema dynamically patched with arrays!');
