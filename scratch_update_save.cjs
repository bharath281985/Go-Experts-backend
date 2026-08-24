const fs = require('fs');
let code = fs.readFileSync('src/controllers/client/client.controller.ts', 'utf8');

const rep = "if (body.attachments !== undefined) data.attachments = body.attachments ? JSON.stringify(body.attachments) : null;\n    \n    // Save all extra form fields to rawDetails if they exist\n    const rawKeys = ['objectives', 'businessGoals', 'skills', 'languages', 'deliverables', 'pricingModel', 'currency', 'paymentTerms', 'milestones'];\n    let hasRawUpdates = false;\n    const currentRaw = project.rawDetails && typeof project.rawDetails === 'object' && !Array.isArray(project.rawDetails) ? project.rawDetails : {};\n    const nextRaw = { ...currentRaw };\n    for (const key of rawKeys) {\n      if (body[key] !== undefined) {\n        nextRaw[key] = body[key];\n        hasRawUpdates = true;\n      }\n    }\n    if (hasRawUpdates) data.rawDetails = nextRaw;";
code = code.replace(
  'if (body.attachments !== undefined) data.attachments = body.attachments ? JSON.stringify(body.attachments) : null;',
  rep
);

fs.writeFileSync('src/controllers/client/client.controller.ts', code);
console.log('Updated updateClientProject with rawDetails!');
