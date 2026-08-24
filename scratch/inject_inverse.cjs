const fs = require('fs');

let lines = fs.readFileSync('prisma/schema.prisma', 'utf8').split(/\\r?\\n/);
let out = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // ClientProfile
  if (line.includes('@@map("client_profiles")') && !out.join('\\n').includes('invitations Invitation[]')) {
    out.push('  invitations Invitation[]');
    out.push('  shortlists Shortlist[]');
  }
  
  // FreelancerProfile
  if (line.includes('@@map("freelancer_profiles")') && !out.join('\\n').includes('shortlists   Shortlist[]')) {
    out.push('  invitations  Invitation[]');
    out.push('  shortlists   Shortlist[]');
  }
  
  // Project
  if (line.includes('@@map("projects")') && !out.join('\\n').includes('shortlists  Shortlist[]')) {
    out.push('  invitations Invitation[]');
    out.push('  shortlists  Shortlist[]');
  }
  
  // Proposal
  if (line.includes('@@map("proposals")') && !out.join('\\n').includes('offers       Offer[]')) {
    out.push('  offers       Offer[]');
  }
  
  // Message
  if (line.includes('@@map("messages")') && !out.join('\\n').includes('reactions      MessageReaction[]')) {
    out.push('  reactions      MessageReaction[]');
  }
  
  // Conversation
  if (line.includes('@@map("conversations")') && !out.join('\\n').includes('states       ConversationState[]')) {
    out.push('  states       ConversationState[]');
  }
  
  // User
  if (line.includes('@@map("users")') && !out.join('\\n').includes('reactions       MessageReaction[]')) {
    out.push('  reactions       MessageReaction[]');
    out.push('  conversationStates ConversationState[]');
    out.push('  reports         Report[]          @relation("Reporter")');
    out.push('  reported        Report[]          @relation("ReportedUser")');
  }

  out.push(line);
}

fs.writeFileSync('prisma/schema.prisma', out.join('\\n'));
console.log('Final missing inverse relations patched perfectly!');
