const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Inverse fields on ClientProfile
if (!s.includes('invitations Invitation[]')) {
  s = s.replace(
    '  projects   Project[]',
    '  projects   Project[]\\n  invitations Invitation[]\\n  shortlists Shortlist[]'
  );
}

// Inverse fields on FreelancerProfile
if (!s.includes('invitations  Invitation[]')) {
  s = s.replace(
    '  proposals    Proposal[]',
    '  proposals    Proposal[]\\n  invitations  Invitation[]\\n  shortlists   Shortlist[]'
  );
}

// Inverse fields on Project
if (!s.includes('invitations Invitation[]')) {
  s = s.replace(
    '  proposals   Proposal[]',
    '  proposals   Proposal[]\\n  invitations Invitation[]\\n  shortlists  Shortlist[]'
  );
}

// Inverse fields on User
if (!s.includes('reported     Report[] @relation("ReportedUser")')) {
  s = s.replace(
    '  ActivityLog   AuditLog[]',
    '  ActivityLog   AuditLog[]\\n  reactions       MessageReaction[]\\n  conversationStates ConversationState[]\\n  reports         Report[]          @relation("Reporter")\\n  reported        Report[]          @relation("ReportedUser")'
  );
}

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Inverse relations added.');
