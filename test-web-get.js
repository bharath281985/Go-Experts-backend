
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjkxYTliOTc1LTE2ZGMtNDRjOS04YzgzLTc2ODUyYzFhMWJjMyIsImVtYWlsIjoiIiwicm9sZSI6ImZyZWVsYW5jZXIiLCJ0eXBlIjoicG9ydGFsIiwiaWF0IjoxNzg1OTE1Mjg4LCJleHAiOjE3ODYwMDE2ODh9.hrO9tDS-ue9SIIzDYa2q_knrpAvXHKAcRFguZQd97wI";
fetch("http://localhost:3000/api/freelancer/portfolio", {
  headers: { "Authorization": `Bearer ${token}` }
}).then(res => res.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(err => console.error(err));

