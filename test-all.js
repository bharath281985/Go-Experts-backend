
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjkxYTliOTc1LTE2ZGMtNDRjOS04YzgzLTc2ODUyYzFhMWJjMyIsImVtYWlsIjoiIiwicm9sZSI6ImZyZWVsYW5jZXIiLCJ0eXBlIjoicG9ydGFsIiwiaWF0IjoxNzg1OTE2NDg5LCJleHAiOjE3ODYwMDI4ODl9.T_Ln1y2TAQvAqxnmuqBSL6HRhDHr_dxUBpLpI5ljT-Q";
const baseUrl = "http://localhost:3000/api/v1/mobile/freelancer/portfolio";
const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

async function run() {
  console.log("=== POST ===");
  const postRes = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      "title": "LMS Platform Development",
      "industry": "Education",
      "industryId": "2efd1837-2644-4884-9bc6-ce90c1df7cb5",
      "category": "LMS Platform Development",
      "categoryId": "lms-platform-development",
      "skills": [ { "skillName": "React" }, { "skillName": "Node.js" } ],
      "status": "Published"
    })
  });
  const postData = await postRes.json();
  console.log(JSON.stringify(postData, null, 2));
  
  if (!postData?.data?.id) return;
  const id = postData.data.id;

  console.log("=== GET ALL ===");
  const getRes = await fetch(baseUrl, { headers });
  const getData = await getRes.json();
  console.log(JSON.stringify(getData, null, 2));

  console.log(`=== GET BY ID (${id}) ===`);
  const getIdRes = await fetch(`${baseUrl}/${id}`, { headers });
  const getIdData = await getIdRes.json();
  console.log(JSON.stringify(getIdData, null, 2));

  console.log(`=== PATCH (${id}) ===`);
  const patchRes = await fetch(`${baseUrl}/${id}`, {
    method: "PUT", // mobile API uses PUT or PATCH? Wait, freelancer.routes uses PATCH and PUT. mobile/freelancer.routes uses updatePortfolioItem
    headers,
    body: JSON.stringify({ "title": "Updated Platform v2" })
  });
  const patchData = await patchRes.json();
  console.log(JSON.stringify(patchData, null, 2));

  console.log(`=== DELETE (${id}) ===`);
  const delRes = await fetch(`${baseUrl}/${id}`, { method: "DELETE", headers });
  const delData = await delRes.json();
  console.log(JSON.stringify(delData, null, 2));
}
run();

