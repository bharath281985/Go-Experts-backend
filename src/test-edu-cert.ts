import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'freelancer', status: 'active', deletedAt: null }
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
  
  console.log("Access Token:", token);
  console.log("\n=========================================");

  const fetchOpts = {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  const baseUrl = "http://localhost:3000/api/freelancer";

  // Test PUT Education
  const putEduRes = await fetch(`${baseUrl}/education`, {
    ...fetchOpts,
    method: "PUT",
    body: JSON.stringify({
      items: [
        {
          institution: "Test University",
          qualification: "Bachelor's",
          specialization: "Computer Science",
          year: "2020",
          percentage: "85",
          cert: "Degree",
          category: "Degrees"
        }
      ]
    })
  });
  console.log("PUT /education =>", await putEduRes.text());

  // Test GET Education
  const getEduRes = await fetch(`${baseUrl}/education`, fetchOpts);
  console.log("GET /education =>", await getEduRes.text());

  // Test PUT Certificates
  const putCertRes = await fetch(`${baseUrl}/certificates`, {
    ...fetchOpts,
    method: "PUT",
    body: JSON.stringify({
      items: [
        {
          name: "AWS Certified Developer",
          issuer: "Amazon",
          number: "AWS-1234",
          issued: "2023-01-15",
          url: "https://aws.amazon.com",
          verified: true
        }
      ]
    })
  });
  console.log("PUT /certificates =>", await putCertRes.text());

  // Test POST Education
  const postEduRes = await fetch(`${baseUrl}/education`, {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({
      institution: "Harvard University",
      qualification: "Master's",
      specialization: "Business",
      year: "2024",
      percentage: "95",
      cert: "MBA",
      category: "Degrees"
    })
  });
  const postEduJson: any = await postEduRes.json();
  console.log("POST /education =>", JSON.stringify(postEduJson));

  if (postEduJson.data && postEduJson.data.id) {
    // Test PUT Education by ID
    const putEduIdRes = await fetch(`${baseUrl}/education/${postEduJson.data.id}`, {
      ...fetchOpts,
      method: "PUT",
      body: JSON.stringify({
        institution: "Harvard Updated"
      })
    });
    console.log(`PUT /education/${postEduJson.data.id} =>`, await putEduIdRes.text());

    // Test DELETE Education
    const delEduRes = await fetch(`${baseUrl}/education/${postEduJson.data.id}`, {
      ...fetchOpts,
      method: "DELETE"
    });
    console.log("DELETE /education =>", await delEduRes.text());
  }

  // Test POST Certificates
  const postCertRes = await fetch(`${baseUrl}/certificates`, {
    ...fetchOpts,
    method: "POST",
    body: JSON.stringify({
      name: "Google Cloud Professional",
      issuer: "Google",
      number: "GCP-001",
      issued: "2024-06-01",
      url: "https://cloud.google.com",
      verified: false
    })
  });
  const postCertJson: any = await postCertRes.json();
  console.log("POST /certificates =>", JSON.stringify(postCertJson));

  if (postCertJson.data && postCertJson.data.id) {
    // Test PUT Certificates by ID
    const putCertIdRes = await fetch(`${baseUrl}/certificates/${postCertJson.data.id}`, {
      ...fetchOpts,
      method: "PUT",
      body: JSON.stringify({
        verified: true,
        issuer: "Google Updated"
      })
    });
    console.log(`PUT /certificates/${postCertJson.data.id} =>`, await putCertIdRes.text());

    // Test DELETE Certificates
    const delCertRes = await fetch(`${baseUrl}/certificates/${postCertJson.data.id}`, {
      ...fetchOpts,
      method: "DELETE"
    });
    console.log("DELETE /certificates =>", await delCertRes.text());
  }
}

main().finally(() => prisma.$disconnect());
