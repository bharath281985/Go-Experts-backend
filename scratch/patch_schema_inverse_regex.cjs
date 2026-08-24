const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

s = s.replace(/  projects   Project\[\]/g, '  projects   Project[]\\n  invitations Invitation[]\\n  shortlists Shortlist[]');
s = s.replace(/  proposals    Proposal\[\]/g, '  proposals    Proposal[]\\n  invitations  Invitation[]\\n  shortlists   Shortlist[]');
s = s.replace(/  proposals   Proposal\[\]/g, '  proposals   Proposal[]\\n  invitations Invitation[]\\n  shortlists  Shortlist[]');
s = s.replace(/  ActivityLog   AuditLog\[\]/g, '  ActivityLog   AuditLog[]\\n  reactions       MessageReaction[]\\n  conversationStates ConversationState[]\\n  reports         Report[]          @relation("Reporter")\\n  reported        Report[]          @relation("ReportedUser")');

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Inverse relations added with regex.');
