const fs = require('fs');
const schemaStr = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = schemaStr.split(/\\r?\\n/);
let out = [];

let inModel = null;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  let modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
  if (modelMatch) {
    inModel = modelMatch[1];
  }

  if (line.trim() === '}') {
    if (inModel === 'User') {
      out.push('  reactions       MessageReaction[]');
      out.push('  conversationStates ConversationState[]');
      out.push('  reports         Report[]          @relation("Reporter")');
      out.push('  reported        Report[]          @relation("ReportedUser")');
    } else if (inModel === 'ClientProfile') {
      out.push('  invitations Invitation[]');
      out.push('  shortlists Shortlist[]');
    } else if (inModel === 'FreelancerProfile') {
      out.push('  invitations Invitation[]');
      out.push('  shortlists Shortlist[]');
    } else if (inModel === 'Project') {
      out.push('  invitations Invitation[]');
      out.push('  shortlists Shortlist[]');
    } else if (inModel === 'Proposal') {
      out.push('  offers Offer[]');
    } else if (inModel === 'Message') {
      out.push('  clientMessageId String? @map("client_message_id")');
      out.push('  replyToId String? @map("reply_to_id")');
      out.push('  deliveryStatus String @default("SENT") @map("delivery_status")');
      out.push('  deletedAt DateTime? @map("deleted_at")');
      out.push('  replyTo Message? @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)');
      out.push('  replies Message[] @relation("MessageReplies")');
      out.push('  reactions MessageReaction[]');
    } else if (inModel === 'Conversation') {
      out.push('  contextType String? @map("context_type")');
      out.push('  investmentId String? @map("investment_id")');
      out.push('  startupIdeaId String? @map("startup_idea_id")');
      out.push('  supportTicketId String? @map("support_ticket_id")');
      out.push('  states ConversationState[]');
    } else if (inModel === 'AuditLog') {
      out.push('  adminId String? @map("admin_id")');
    } else if (inModel === 'Notification') {
      out.push('  count Int @default(1)');
      out.push('  actorId String? @map("actor_id")');
      out.push('  contextType String? @map("context_type")');
      out.push('  contextId String? @map("context_id")');
      out.push('  actionUrl String? @map("action_url")');
    }
    
    inModel = null;
  }

  out.push(line);
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
].join('\\n');

let finalText = out.join('\\n');
if (!finalText.includes('model BusinessActivity')) {
  finalText += appendedModels;
}

fs.writeFileSync('prisma/schema.prisma', finalText);
console.log('Schema perfectly repaired using block ends!');
