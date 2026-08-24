import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function resetPasswords() {
  const password = "Goexperts@2025";
  const hashedPassword = await bcrypt.hash(password, 10);

  const emails = [
    "fl.arjun0@goexperts.com",
    "cl.kamala99@goexperts.com"
  ];

  for (const email of emails) {
    await prisma.user.updateMany({
      where: { email },
      data: { password: hashedPassword }
    });
    console.log(`Password reset for ${email} to: ${password}`);
  }
}

resetPasswords().catch(console.error).finally(() => prisma.$disconnect());
