const fs = require('fs');
const content = fs.readFileSync('pages/post-detail/post-detail.vue', 'utf8');
content.split(/\r?\n/).forEach((line, idx) => {
  if (line.includes('multipart/form-data')) {
    console.log(idx + 1, line);
  }
});
