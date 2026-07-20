async function main() {
  try {
    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test User",
        email: "test2@example.com",
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
    console.log("Body:", text);
  } catch (e) {
    console.error(e);
  }
}
main();
