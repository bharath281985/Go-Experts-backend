import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const API_URL = "http://localhost:5001";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

async function post(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return {
    statusCode: res.status,
    body: await res.json().catch(() => ({}))
  };
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${API_URL}${path}`, { headers });
  return {
    statusCode: res.status,
    body: await res.json().catch(() => ({}))
  };
}

async function runTests() {
  console.log("=== Starting Phase 5 Security Validation ===");

  // 1. Transaction Security
  console.log("\n--- 1. Transaction Security ---");
  const validTransaction = jwt.sign(
    { provider: "google", providerUserId: "test_transaction_user", email: "transaction@test.com", purpose: "SOCIAL_REGISTRATION" },
    JWT_SECRET,
    { expiresIn: "30m", jwtid: crypto.randomBytes(16).toString("hex") }
  );

  const missingPurposeTx = jwt.sign(
    { provider: "google", providerUserId: "test_transaction_user2", email: "transaction2@test.com" },
    JWT_SECRET,
    { expiresIn: "30m" }
  );

  const wrongSecretTx = jwt.sign(
    { provider: "google", providerUserId: "test_transaction_user3", email: "transaction3@test.com", purpose: "SOCIAL_REGISTRATION" },
    "WRONG_SECRET",
    { expiresIn: "30m" }
  );

  // Replay on select-role
  const res1 = await post("/api/auth/social/select-role", { role: "freelancer" }, { "Authorization": `Bearer ${validTransaction}` });
  console.log("Valid transaction select-role:", res1.body.success ? "PASS" : "FAIL", res1.body);

  // Replay MUST FAIL
  const res2 = await post("/api/auth/social/select-role", { role: "client" }, { "Authorization": `Bearer ${validTransaction}` });
  console.log("Replay transaction select-role:", !res2.body.success ? "PASS" : "FAIL");

  // Missing purpose MUST FAIL
  const res3 = await post("/api/auth/social/select-role", { role: "freelancer" }, { "Authorization": `Bearer ${missingPurposeTx}` });
  console.log("Missing purpose select-role:", !res3.body.success ? "PASS" : "FAIL");

  // Wrong secret MUST FAIL
  const res4 = await post("/api/auth/social/select-role", { role: "freelancer" }, { "Authorization": `Bearer ${wrongSecretTx}` });
  console.log("Wrong secret select-role:", !res4.body.success ? "PASS" : "FAIL");

  // JWT cannot be used as transaction
  const normalJwt = jwt.sign({ id: "fake_id", role: "freelancer" }, JWT_SECRET);
  const res5 = await post("/api/auth/social/select-role", { role: "freelancer" }, { "Authorization": `Bearer ${normalJwt}` });
  console.log("Normal JWT as transaction:", !res5.body.success ? "PASS" : "FAIL");

  // Transaction JWT cannot be used for normal APIs
  const res6 = await get("/api/auth/me", { "Authorization": `Bearer ${validTransaction}` });
  console.log("Transaction JWT against normal API (/auth/me):", res6.statusCode === 401 || res6.statusCode === 403 ? "PASS" : "FAIL");

  // 2. Account-Linking Security
  console.log("\n--- 2. Account-Linking Security ---");
  const linkPassword = "TestPassword123!";
  const linkHashedPassword = await bcrypt.hash(linkPassword, 10);
  
  // Create user to link
  const linkUser = await prisma.user.create({
    data: {
      email: "link_test@test.com",
      password: linkHashedPassword,
      fullName: "Link Test User",
      role: "client"
    }
  });

  const linkTx = jwt.sign(
    { provider: "google", providerUserId: "google_link_123", email: "link_test@test.com", purpose: "SOCIAL_REGISTRATION" },
    JWT_SECRET,
    { expiresIn: "30m" }
  );

  // Wrong password
  const linkRes1 = await post("/api/auth/social/link", { email: "link_test@test.com", password: "WrongPassword" }, { "Authorization": `Bearer ${linkTx}` });
  console.log("Wrong password linking:", !linkRes1.body.success ? "PASS" : "FAIL");

  // Correct password
  const linkRes2 = await post("/api/auth/social/link", { email: "link_test@test.com", password: linkPassword }, { "Authorization": `Bearer ${linkTx}` });
  console.log("Correct password linking:", linkRes2.body.success ? "PASS" : "FAIL", linkRes2.body);

  // Replay linking
  const linkRes3 = await post("/api/auth/social/link", { email: "link_test@test.com", password: linkPassword }, { "Authorization": `Bearer ${linkTx}` });
  console.log("Replay linking:", !linkRes3.body.success ? "PASS" : "FAIL");

  const linkTx2 = jwt.sign(
    { provider: "google", providerUserId: "google_link_456", email: "link_test@test.com", purpose: "SOCIAL_REGISTRATION" },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
  // Replay linking with another token (same email, different provider user id - but the token itself wasn't used, wait, no. The user asked to test replay of the *same* token. The above already does that because `linkRes2` uses `linkTx` and succeeds, and then `linkRes3` uses `linkTx` and fails. 
  

  // 3. Provider Identity Uniqueness
  console.log("\n--- 3. Provider Identity Uniqueness ---");
  
  const dupTx1 = jwt.sign(
    { provider: "google", providerUserId: "dup_provider_123", email: "dup1@test.com", purpose: "SOCIAL_REGISTRATION" },
    JWT_SECRET, { expiresIn: "30m" }
  );
  
  const dupTx2 = jwt.sign(
    { provider: "google", providerUserId: "dup_provider_123", email: "dup2@test.com", purpose: "SOCIAL_REGISTRATION" },
    JWT_SECRET, { expiresIn: "30m" }
  );

  const dupRes1 = await post("/api/auth/social/select-role", { role: "freelancer" }, { "Authorization": `Bearer ${dupTx1}` });
  const dupRes2 = await post("/api/auth/social/select-role", { role: "client" }, { "Authorization": `Bearer ${dupTx2}` });
  
  console.log("Duplicate identity rejection:", dupRes1.body.success && !dupRes2.body.success ? "PASS" : "FAIL");
  console.log("Duplicate identity error cleanly handled:", (!dupRes2.body.success && (dupRes2.statusCode === 400 || dupRes2.statusCode === 409) && !dupRes2.body.message?.includes("Prisma")) ? "PASS" : "FAIL", dupRes2.statusCode, dupRes2.body);

  // 4. Multi-Provider & Role Isolation
  console.log("\n--- 4. Multi-Provider & Role Isolation ---");
  
  // Create user
  const isoUser = await prisma.user.create({
    data: { email: "iso@test.com", role: "freelancer", fullName: "Iso User" }
  });

  const isoJwt = jwt.sign({ id: isoUser.id, email: isoUser.email, role: "freelancer", type: "portal" }, JWT_SECRET);
  
  // Try accessing client API
  const isoRes1 = await get("/api/client/dashboard", { "Authorization": `Bearer ${isoJwt}` });
  
  console.log("Role isolation (freelancer -> client API):", isoRes1.statusCode === 403 ? "PASS" : "FAIL", isoRes1.statusCode);

  // 5. Account Status & Onboarding Guard
  console.log("\n--- 5. Account Status & Onboarding Guard ---");
  
  // Create suspended user
  const suspendedUser = await prisma.user.create({
    data: { email: "suspended@test.com", role: "freelancer", fullName: "Suspended", status: "SUSPENDED" }
  });
  
  const suspendedJwt = jwt.sign({ id: suspendedUser.id, email: suspendedUser.email, role: "freelancer", type: "portal" }, JWT_SECRET);
  
  const susRes1 = await get("/api/auth/me", { "Authorization": `Bearer ${suspendedJwt}` });
  
  console.log("Suspended user rejected (/auth/me):", susRes1.statusCode === 403 ? "PASS" : "FAIL");

  // 6. OAuth State Security
  console.log("\n--- 6. OAuth State Security ---");
  
  const oauthRes1 = await get("/api/auth/google/callback?code=mockcode");
  console.log("Missing state Google:", oauthRes1.statusCode === 400 ? "PASS" : "FAIL");
  
  const oauthRes2 = await get("/api/auth/google/callback?code=mockcode&state=invalid", { "Cookie": "google_oauth_state=valid" });
  console.log("Invalid state Google:", oauthRes2.statusCode === 400 ? "PASS" : "FAIL");

  // Cleanup
  console.log("\n--- Cleanup ---");
  await prisma.authIdentity.deleteMany({
    where: { providerUserId: { in: ["test_transaction_user", "google_link_123", "dup_provider_123"] } }
  });
  await prisma.user.deleteMany({
    where: { email: { in: ["transaction@test.com", "link_test@test.com", "dup1@test.com", "dup2@test.com", "iso@test.com", "suspended@test.com"] } }
  });
  console.log("Test data cleaned up.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());








