const fs = require('fs');
const content = fs.readFileSync('pages/add/add.vue', 'utf8');
const lines = content.split(/\r?\n/);
const line = lines.find(l => l.includes('multipart/form-data'));
console.log('line:', line);
console.log('char codes:', Array.from(line).map(ch => ch.charCodeAt(0)));
