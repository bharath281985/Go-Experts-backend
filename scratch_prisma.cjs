const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');
code = code.replace(
  'attachments     String?     @db.Text',
  'attachments     String?     @db.Text\n  rawDetails      Json?       @map("raw_details")'
);
fs.writeFileSync('prisma/schema.prisma', code);
