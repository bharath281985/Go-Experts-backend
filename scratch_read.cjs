const fs = require('fs');
const content = fs.readFileSync('src/controllers/auth/auth.controller.ts', 'utf8');
const lines = content.split('\n');
for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('export const login =')) {
        console.log(lines.slice(i, i+150).join('\n'));
        break;
    }
}
