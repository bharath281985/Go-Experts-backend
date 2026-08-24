const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

const referralModels = `

model ReferralCampaign {
  id          String   @id @default(uuid())
  name        String
  description String?  @db.Text
  status      String   @default("ACTIVE")
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
  referrerRole    String   @default("ANY") @map("referrer_role")
  referredRole    String   @default("ANY") @map("referred_role")
  rewardType      String   @default("CREDIT") @map("reward_type")
  rewardAmount    Float    @map("reward_amount")
  qualification   String   @default("SIGNUP")
  conditions      String?  @db.Text
  
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
`;

if (!schema.includes('model ReferralCampaign')) {
  schema += referralModels;
}

schema = schema.replace(
  /model Referral \{[\s\S]*?\@\@map\("referrals"\)\n\}/,
  [
    'model Referral {',
    '  id         String   @id @default(uuid())',
    '  referrerId String   @map("referrer_id")',
    '  refereeId  String   @map("referee_id")',
    '  campaignId String?  @map("campaign_id")',
    '  clickId    String?  @map("click_id")',
    '  status     String   @default("PENDING")',
    '  createdAt  DateTime @default(now()) @map("created_at")',
    '  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")',
    '',
    '  campaign ReferralCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)',
    '  click    ReferralClick?    @relation(fields: [clickId], references: [id], onDelete: SetNull)',
    '  referrer User              @relation("Referrer", fields: [referrerId], references: [id], onDelete: Cascade)',
    '  referee  User              @relation("Referee", fields: [refereeId], references: [id], onDelete: Cascade)',
    '',
    '  events  ReferralEvent[]',
    '  rewards ReferralReward[]',
    '',
    '  @@index([referrerId])',
    '  @@index([campaignId])',
    '  @@index([clickId])',
    '  @@map("referrals")',
    '}'
  ].join('\\n')
);

if (!schema.includes('model ReferralEvent')) {
  schema += '\\n' + [
    'model ReferralEvent {',
    '  id         String   @id @default(uuid())',
    '  referralId String   @map("referral_id")',
    '  eventType  String   @map("event_type")',
    '  metadata   String?  @db.Text',
    '  createdAt  DateTime @default(now()) @map("created_at")',
    '  referral   Referral @relation(fields: [referralId], references: [id], onDelete: Cascade)',
    '',
    '  @@index([referralId])',
    '  @@map("referral_events")',
    '}'
  ].join('\\n') + '\\n';
}

schema = schema.replace(
  /model ReferralReward \{[\s\S]*?\@\@map\("referral_rewards"\)\n\}/,
  [
    'model ReferralReward {',
    '  id         String   @id @default(uuid())',
    '  referralId String   @map("referral_id")',
    '  amount     Float    @default(0)',
    '  rewardType String   @default("CREDIT") @map("reward_type")',
    '  status     String   @default("PENDING")',
    '  createdAt  DateTime @default(now()) @map("created_at")',
    '  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")',
    '  referral   Referral @relation(fields: [referralId], references: [id], onDelete: Cascade)',
    '',
    '  @@index([referralId])',
    '  @@map("referral_rewards")',
    '}'
  ].join('\\n')
);

fs.writeFileSync(schemaPath, schema);
console.log("Schema repaired");
