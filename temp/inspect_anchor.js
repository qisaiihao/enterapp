const fs = require('fs');
const content = fs.readFileSync('pages/add/add.vue', 'utf8');
const anchor = '        // ͨ���ƺ����ϴ��ļ������H5����multipart/form-data���⣩';
console.log('index', content.indexOf(anchor));
const snippet = content.slice(content.indexOf(anchor) - 20, content.indexOf(anchor) + anchor.length + 20);
console.log(snippet);
