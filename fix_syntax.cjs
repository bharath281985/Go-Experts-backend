const fs = require('fs');
const file = 'src/services/mobile/email.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Revert the ? and ?? replacements that broke TypeScript syntax
content = content.split('🛡️').join('?');
content = content.split('🔄').join('??');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed TypeScript syntax errors!');
