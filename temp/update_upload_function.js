const fs = require('fs');
const path = process.argv[2];
const logTag = process.argv[3] || 'Upload';
if (!path) {
  throw new Error('file path required');
}
let content = fs.readFileSync(path, 'utf8');
const keyword = 'uploadFileViaCloudFunction';
const fnIndex = content.indexOf(keyword);
if (fnIndex === -1) {
  throw new Error('function not found in ' + path);
}
let blockStart = content.lastIndexOf('\n', fnIndex);
blockStart = blockStart === -1 ? 0 : blockStart + 1;
const prevLineEnd = blockStart - 2;
if (prevLineEnd >= 0) {
  const prevLineStart = content.lastIndexOf('\n', prevLineEnd) + 1;
  const prevLine = content.slice(prevLineStart, blockStart - 1).trim();
  if (prevLine.startsWith('//') && prevLine.includes('multipart/form-data')) {
    blockStart = prevLineStart;
  }
}
const braceStart = content.indexOf('{', fnIndex);
if (braceStart === -1) {
  throw new Error('opening brace not found');
}
let depth = 0;
let end = -1;
for (let i = braceStart; i < content.length; i++) {
  const ch = content[i];
  if (ch === '{') {
    depth++;
  } else if (ch === '}') {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end === -1) {
  throw new Error('closing brace not found');
}
const trailingMatch = content.slice(end + 1).match(/^[ \t,\r\n]*/);
const trailing = trailingMatch ? trailingMatch[0] : '';
const blockEnd = end + 1 + trailing.length;
const commentLine = '        // 通过云函数上传文件（解决H5环境multipart/form-data问题）';
const lines = [
commentLine,
"        uploadFileViaCloudFunction(cloudPath, filePath, retryCount = 0) {",
"            return readFileAsBase64(filePath)",
"                .then((base64) => {",
"                    if (!base64) {",
"                        throw new Error('文件读取失败');",
"                    }",
`                    console.log('[${logTag}] 文件读取完成，base64长度:', base64.length);`,
"                    if (base64.length > 6 * 1024 * 1024) {",
`                        console.warn('[${logTag}] base64文件较大，注意上传耗时');`,
"                    }",
"                    return this.callCloudFunction('upload', {",
"                        cloudPath,",
"                        fileContent: base64",
"                    });",
"                })",
"                .then((uploadRes) => {",
`                    console.log('[${logTag}] 云函数返回结果:', uploadRes);`,
"                    if (uploadRes && uploadRes.result && uploadRes.result.success) {",
"                        return {",
"                            fileID: uploadRes.result.fileID,",
"                            cloudPath: uploadRes.result.cloudPath",
"                        };",
"                    }",
"                    throw new Error('上传云函数返回格式异常');",
"                })",
"                .catch((err) => {",
"                    const message = (err && err.errMsg) || (err && err.message) || '';",
"                    const shouldRetry = retryCount < 2 && (message.includes('request:fail') || message.includes('timeout') || message.includes('网络'));",
`                    if (shouldRetry) {`,
`                        console.log('[${logTag}] 上传失败，准备重试 (${retryCount + 1}/2)', err);`,
"                        return new Promise((resolve, reject) => {",
"                            setTimeout(() => {",
"                                this.uploadFileViaCloudFunction(cloudPath, filePath, retryCount + 1)",
"                                    .then(resolve)",
"                                    .catch(reject);",
"                            }, 1000 * (retryCount + 1));",
"                        });",
"                    }",
"                    throw err;",
"                });",
"        }"
];
const newBlock = lines.join('\n') + trailing;
content = content.slice(0, blockStart) + newBlock + content.slice(blockEnd);
fs.writeFileSync(path, content, 'utf8');
