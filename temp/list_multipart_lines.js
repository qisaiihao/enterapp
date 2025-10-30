const fs = require('fs');
const content = fs.readFileSync('pages/add/add.vue', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('multipart/form-data')) {
    console.log(idx + 1, line);
  }
});
