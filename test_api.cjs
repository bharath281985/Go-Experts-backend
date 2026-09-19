
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

async function test() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length < 2) return;
  
  const token = jwt.sign({ id: users[0].id, role: users[0].role }, process.env.JWT_SECRET || 'secret');
  
  const res = await fetch('http://localhost:3000/api/connections/invitations/sent', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
test();
