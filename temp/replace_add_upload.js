const fs = require('fs');
const path = 'pages/add/add.vue';
let content = fs.readFileSync(path, 'utf8');
const pattern = /uploadFileViaCloudFunction\(cloudPath, filePath, retryCount = 0\)\s*{\s*return new Promise\([\s\S]*?\s*}\s*,/;
if (!pattern.test(content)) {
  throw new Error('pattern not found');
}
const replacement = [
"        uploadFileViaCloudFunction(cloudPath, filePath, retryCount = 0) {",
"            return readFileAsBase64(filePath)",
"                .then((base64) => {",
"                    if (!base64) {",
"                        throw new Error('文件读取失败');",
"                    }",
"                    console.log(`?? [Addҳ��] 文件读取完成，base64长度: ${base64.length}`);",
"                    if (base64.length > 6 * 1024 * 1024) {",
"                        console.warn('?? [Addҳ��] base64文件较大，注意上传耗时');",
"                    }",
"                    return this.callCloudFunction('upload', {",
"                        cloudPath,",
"                        fileContent: base64",
"                    });",
"                })",
"                .then((uploadRes) => {",
"                    console.log('云函数返回结果:', uploadRes);",
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
"                    const shouldRetry = retryCount < 2 && (message.includes('request:fail') || message.includes('timeout'));",
"                    if (shouldRetry) {",
"                        console.log(`?? [Addҳ��] 上传失败，准备重试 (${retryCount + 1}/2)`, err);",
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
"        },"
].join('\n');
content = content.replace(pattern, replacement);
fs.writeFileSync(path, content, 'utf8');
