import express from 'express';
import { register } from './src/controllers/auth/auth.controller.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';

const app = express();
app.use(express.json());
app.post('/register', register);
app.use(errorMiddleware);

app.listen(5001, async () => {
  console.log('Server started on 5001');
  try {
    const res = await fetch("http://localhost:5001/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test User",
        email: "test_register@example.com",
        password: "password123",
        role: "client",
        company: "My Company",
        bio: "Test bio",
        website: "",
        gstNumber: "",
        teamSize: "1-10",
        annualRequirement: "",
        serviceLocation: "",
        category: "Website & App Development",
        subCategory: "Business Website",
        businessType: "Startup",
        industry: "Technology",
        lookingFor: ["Post a Project"],
        expansionGoals: JSON.stringify([]),
        features: JSON.stringify(["Post a Project"]),
        projectData: JSON.stringify({}),
        mobile: "1234567890",
        subscriptionPlan: "Free",
        country: "India",
        state: "Maharashtra",
        city: "Mumbai"
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});
