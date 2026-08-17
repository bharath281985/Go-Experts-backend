const fs = require('fs');
const files = [
  'src/services/admin/about.service.ts',
  'src/services/admin/careers.service.ts',
  'src/services/admin/contact.service.ts'
];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/`https:\/\/images\.unsplash\.com\/[^`]+`/g, '``');
  code = code.replace(/\"https:\/\/images\.unsplash\.com\/[^\"]+\"/g, '\"\"');
  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
}
