const fs = require('fs');

let lines = fs.readFileSync('prisma/schema.prisma', 'utf8').split(/\\r?\\n/);
let out = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  out.push(line);
  
  if (line.includes('projects   Project[]')) {
    out.push('  invitations Invitation[]');
    out.push('  shortlists Shortlist[]');
  }
  else if (line.includes('proposals    Proposal[]')) {
    out.push('  invitations  Invitation[]');
    out.push('  shortlists   Shortlist[]');
  }
  else if (line.includes('proposals   Proposal[]')) {
    out.push('  invitations Invitation[]');
    out.push('  shortlists  Shortlist[]');
  }
  else if (line.includes('ActivityLog   AuditLog[]')) {
    out.push('  reactions       MessageReaction[]');
    out.push('  conversationStates ConversationState[]');
    out.push('  reports         Report[]          @relation("Reporter")');
    out.push('  reported        Report[]          @relation("ReportedUser")');
  }
}

fs.writeFileSync('prisma/schema.prisma', out.join('\\n'));
console.log('Inverse relations added line by line!');
