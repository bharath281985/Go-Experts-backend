import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'freelancer' }
  });

  if (!user) {
    console.log("No freelancer found in DB!");
    return;
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    type: "portal",
  };

  const secret = process.env.JWT_SECRET || "default_jwt_secret";
  const token = jwt.sign(payload, secret, { expiresIn: '1d' });

  console.log("=================================");
  console.log("FREELANCER EMAIL:", user.email);
  console.log("ACCESS TOKEN:", token);
  console.log("=================================");
  console.log(`curl -X GET http://localhost:3000/api/freelancer/portfolio \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`);
}

main().finally(() => prisma.$disconnect());
