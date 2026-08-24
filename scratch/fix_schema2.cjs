const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Use precise string replacements to remove the original Referral and ReferralReward models
const referralOriginal = `model Referral {
  id         String           @id @default(uuid())
  referrerId String           @map("referrer_id")
  refereeId  String           @unique @map("referee_id")
  link       String?
  qrCode     String?          @map("qr_code")
  status     String           @default("pending")
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")
  rewards    ReferralReward[]
  referee    User             @relation("Referee", fields: [refereeId], references: [id], onDelete: Cascade)
  referrer   User             @relation("Referrer", fields: [referrerId], references: [id], onDelete: Cascade)

  @@index([referrerId], map: "referrals_referrer_id_fkey")
  @@map("referrals")
}`;

const referralRewardOriginal = `model ReferralReward {
  id         String   @id @default(uuid())
  referralId String   @map("referral_id")
  points     Int      @default(0)
  amount     Float    @default(0)
  status     String   @default("active")
  createdAt  DateTime @default(now()) @map("created_at")
  referral   Referral @relation(fields: [referralId], references: [id], onDelete: Cascade)

  @@index([referralId], map: "referral_rewards_referral_id_fkey")
  @@map("referral_rewards")
}`;

schema = schema.replace(referralOriginal, '');
schema = schema.replace(referralRewardOriginal, '');

const newModels = `
model ReferralCampaign {
  id          String   @id @default(uuid())
  name        String
  description String?  @db.Text
  status      String   @default("ACTIVE") // ACTIVE, PAUSED, ENDED
  startDate   DateTime @default(now()) @map("start_date")
  endDate     DateTime? @map("end_date")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")

  rules       ReferralRule[]
  referrals   Referral[]

  @@map("referral_campaigns")
}

model ReferralRule {
  id              String   @id @default(uuid())
  campaignId      String   @map("campaign_id")
  referrerRole    String   @default("ANY") @map("referrer_role") // ANY, client, freelancer, etc.
  referredRole    String   @default("ANY") @map("referred_role")
  rewardType      String   @default("CREDIT") @map("reward_type") // CREDIT, DISCOUNT, FIXED
  rewardAmount    Float    @map("reward_amount")
  qualification   String   @default("SIGNUP") // SIGNUP, VERIFIED, FIRST_PROJECT, FIRST_CONTRACT, FIRST_INVESTMENT
  conditions      String?  @db.Text // JSON string for conditions like { minAmount: 100 }
  
  campaign ReferralCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@map("referral_rules")
}

model ReferralClick {
  id               String   @id @default(uuid())
  referralCode     String   @map("referral_code")
  referrerId       String   @map("referrer_id")
  ipAddress        String?  @map("ip_address")
  userAgent        String?  @map("user_agent")
  landingSessionId String?  @map("landing_session_id")
  createdAt        DateTime @default(now()) @map("created_at")
  
  referrals        Referral[]
  
  @@map("referral_clicks")
}

model Referral {
  id         String   @id @default(uuid())
  referrerId String   @map("referrer_id")
  refereeId  String   @map("referee_id")
  campaignId String?  @map("campaign_id")
  clickId    String?  @map("click_id")
  status     String   @default("PENDING") // PENDING, QUALIFIED, REJECTED
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")

  campaign ReferralCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  click    ReferralClick?    @relation(fields: [clickId], references: [id], onDelete: SetNull)
  referrer User              @relation("Referrer", fields: [referrerId], references: [id], onDelete: Cascade)
  referee  User              @relation("Referee", fields: [refereeId], references: [id], onDelete: Cascade)

  events  ReferralEvent[]
  rewards ReferralReward[]

  @@index([referrerId])
  @@index([campaignId])
  @@index([clickId])
  @@map("referrals")
}

model ReferralEvent {
  id         String   @id @default(uuid())
  referralId String   @map("referral_id")
  eventType  String   @map("event_type") // CLICKED, SIGNED_UP, VERIFIED, QUALIFIED
  metadata   String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at")
  referral   Referral @relation(fields: [referralId], references: [id], onDelete: Cascade)

  @@index([referralId])
  @@map("referral_events")
}

model ReferralReward {
  id         String   @id @default(uuid())
  referralId String   @map("referral_id")
  amount     Float    @default(0)
  rewardType String   @default("CREDIT") @map("reward_type") // CREDIT, DISCOUNT
  status     String   @default("PENDING") // PENDING, APPROVED, REJECTED, CREDITED
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")
  referral   Referral @relation(fields: [referralId], references: [id], onDelete: Cascade)

  @@index([referralId])
  @@map("referral_rewards")
}
`;

schema += '\n' + newModels;
fs.writeFileSync(schemaPath, schema);
console.log('Schema replacement successful.');
