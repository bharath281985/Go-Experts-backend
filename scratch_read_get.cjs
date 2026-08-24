const fs = require('fs');
const content = fs.readFileSync('src/controllers/client/client.controller.ts', 'utf8');
const lines = content.split('\n');
let start = -1;
for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('export const getClientProject =')) {
        start = i; break;
    }
}
console.log(lines.slice(start, start+40).join('\n'));
