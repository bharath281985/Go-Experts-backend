const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const referrals = \`
model ReferralCampaign {
  id String @id @default(uuid())
  name String
  status String @default("ACTIVE")
  rewardType String
  rules ReferralRule[]
  referrals Referral[]
  clicks ReferralClick[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("referral_campaigns")
}

model ReferralRule {
  id String @id @default(uuid())
  campaignId String
  qualification String
  rewardAmount Float
  campaign ReferralCampaign @relation(fields: [campaignId], references: [id])
  @@map("referral_rules")
}

model ReferralClick {
  id String @id @default(uuid())
  campaignId String?
  referrerId String?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  campaign ReferralCampaign? @relation(fields: [campaignId], references: [id])
  @@map("referral_clicks")
}

model Referral {
  id String @id @default(uuid())
  campaignId String
  referrerId String
  refereeId String
  status String @default("PENDING")
  campaign ReferralCampaign @relation(fields: [campaignId], references: [id])
  referrer User @relation("Referrer", fields: [referrerId], references: [id])
  referee User @relation("Referee", fields: [refereeId], references: [id])
  events ReferralEvent[]
  rewards ReferralReward[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("referrals")
}

model ReferralEvent {
  id String @id @default(uuid())
  referralId String
  eventType String
  metadata String? @db.Text
  referral Referral @relation(fields: [referralId], references: [id])
  createdAt DateTime @default(now())
  @@map("referral_events")
}

model ReferralReward {
  id String @id @default(uuid())
  referralId String
  amount Float
  status String @default("PENDING")
  referral Referral @relation(fields: [referralId], references: [id])
  createdAt DateTime @default(now())
  @@map("referral_rewards")
}
\`;

if (!schema.includes('model ReferralCampaign')) {
  fs.appendFileSync(schemaPath, '\\n' + referrals + '\\n');
  console.log('Referral models appended.');
} else {
  console.log('Referral models already exist.');
}
