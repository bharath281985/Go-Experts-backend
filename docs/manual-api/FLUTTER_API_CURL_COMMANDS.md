# Go Experts — Flutter Implemented API cURL Command Templates

Use these cURL commands to execute manual testing against your local or production backend.

```bash
# Set environment variables
export BASE_URL="http://localhost:3000/api"
export TOKEN="YOUR_ACCESS_TOKEN_HERE"
```

---

## 1. Authentication APIs

### Register Account
```bash
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john.freelancer@example.com",
    "password": "Password@123",
    "role": "freelancer"
  }'
```

### Login Account
```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@goexperts.in",
    "password": "Admin@12345"
  }'
```

### Onboarding Draft Save
```bash
curl -X PATCH "$BASE_URL/auth/onboarding/draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": 2,
    "titleHeadline": "Senior Full Stack Engineer",
    "country": "India",
    "city": "Mumbai"
  }'
```

---

## 2. Master Data APIs

### Search Skills (1,815 Items)
```bash
curl -X GET "$BASE_URL/v1/mobile/public/skills?search=react&limit=30"
```

### Fetch Industries (134 Items)
```bash
curl -X GET "$BASE_URL/v1/mobile/public/industries"
```

### Fetch Designations (165 Items)
```bash
curl -X GET "$BASE_URL/public/masters?type=designation"
```

---

## 3. Role Dashboard APIs

### Freelancer Dashboard
```bash
curl -X GET "$BASE_URL/freelancer/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

### Client Dashboard
```bash
curl -X GET "$BASE_URL/client/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

### Client Project Details
```bash
curl -X GET "$BASE_URL/client/projects/acdb4887-b6c1-43df-882d-0873cdc2bac4" \
  -H "Authorization: Bearer $TOKEN"
```

### Client Project Details Response
```json
{
  "success": true,
  "message": "Project details",
  "data": {
    "id": "acdb4887-b6c1-43df-882d-0873cdc2bac4",
    "title": "Project Title",
    "description": "Project description",
    "clientId": "user-id",
    "clientName": "Client Name",
    "clientAvatar": null,
    "clientVerified": true,
    "industry": {
      "id": "industry-uuid",
      "name": "Software Development"
    },
    "skills": [
      {
        "skillId": "skill-id-1",
        "skillName": "React"
      },
      {
        "skillId": "skill-id-2",
        "skillName": "Node.js"
      }
    ],
    "techStack": ["React", "Node.js"],
    "technology": "React, Node.js",
    "budget": 60000,
    "budgetMin": 50000,
    "budgetMax": 60000,
    "isHourly": false,
    "timeline": "4 weeks",
    "workMode": "Remote",
    "experienceLevel": {
      "id": "experience-level-uuid",
      "name": "Intermediate"
    },
    "attachments": [],
    "status": "draft",
    "createdAt": "2026-08-24T09:00:00.000Z",
    "updatedAt": "2026-08-24T09:00:00.000Z",
    "proposalsCount": 0,
    "shareCount": 0,
    "isOwner": true,
    "milestones": [],
    "tasks": []
  }
}
```

### Update Client Project
```bash
curl -X PUT "$BASE_URL/client/projects/acdb4887-b6c1-43df-882d-0873cdc2bac4" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Project Title",
    "industryId": "industry-uuid",
    "experienceLevelId": "experience-level-uuid",
    "budget": 60000,
    "timeline": "4 weeks",
    "workMode": "Remote"
  }'
```

### Investor Dashboard
```bash
curl -X GET "$BASE_URL/investor/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

### Founder Startup Profile
```bash
curl -X GET "$BASE_URL/founder/startup" \
  -H "Authorization: Bearer $TOKEN"
```
