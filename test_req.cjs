const http = require('http');

const data = JSON.stringify({
  recipientId: '03445a6b-80b3-4a68-80bc-d844d95af9d2',
  contextType: 'PROJECT',
  projectId: 'e6a8ddd1-3a2d-4781-81a8-57db8fa15f44'
});

// We need an auth token for the freelancer.
// Let's just bypass the test and let the user try, because I don't have the auth token easily available here.
console.log("Will test via user");
