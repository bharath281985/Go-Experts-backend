import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { 
      role: 'freelancer',
      status: 'active'
    }
  });

  if (!user) {
    console.log("No ACTIVE freelancer found in DB!");
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
  console.log("FREELANCER STATUS:", user.status);
  console.log("ACCESS TOKEN:", token);
  console.log("=================================");
}

main().finally(() => prisma.$disconnect());
