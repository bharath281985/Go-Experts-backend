const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
s = s.replace(/\\n/g, '\n');
fs.writeFileSync('prisma/schema.prisma', s);
