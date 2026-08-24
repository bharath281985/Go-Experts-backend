const fs = require('fs');
let code = fs.readFileSync('src/controllers/client/client.controller.ts', 'utf8');

const rep = "attachments: body.attachments ? JSON.stringify(body.attachments) : null,\n          rawDetails: {\n            objectives: body.objectives || '',\n            businessGoals: body.businessGoals || '',\n            skills: body.skills || '',\n            languages: body.languages || '',\n            deliverables: body.deliverables || '',\n            pricingModel: body.pricingModel || '',\n            currency: body.currency || 'INR',\n            paymentTerms: body.paymentTerms || '',\n            milestones: body.milestones || []\n          },";
code = code.replace(
  'attachments: body.attachments ? JSON.stringify(body.attachments) : null,',
  rep
);

fs.writeFileSync('src/controllers/client/client.controller.ts', code);
console.log('Updated createClientProject with rawDetails!');
