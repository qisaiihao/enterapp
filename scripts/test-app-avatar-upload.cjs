const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const cloudPath = 'user_avatars/avatar.jpg';
const filePath = '_doc/uniapp_temp/avatar.jpg';
const fileID = 'cloud://test/user_avatars/avatar.jpg';

function loadFunctions(relativePath, globals, names) {
  let source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.end);
    }
  }
  source += `\nmodule.exports = { ${names.join(', ')} };`;
  const context = { module: { exports: {} }, ...globals };
  vm.runInNewContext(source, context, { filename: relativePath });
  return context.module.exports;
}

function loadUploadCompat(globals) {
  return loadFunctions('utils/upload-compat.js', globals, ['uploadFileCompat']);
}

function loadAppRequest(globals) {
  const source = fs.readFileSync(path.join(root, 'utils/runtime-bootstrap.js'), 'utf8');
  const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'AppPlusTcbRequest');
  assert.ok(declaration, 'App upload adapter must exist');
  return vm.runInNewContext(`${source.slice(declaration.start, declaration.end)}\nAppPlusTcbRequest`, globals);
}

async function testApp(platform) {
  const calls = [];
  const uni = {
    uploadFile(options) {
      calls.push(options);
      options.success({ statusCode: 200, data: '' });
      return { onProgressUpdate() {} };
    }
  };
  const AppPlusTcbRequest = loadAppRequest({ uni, formatRequestUrl: url => url, Promise, Error, parseInt });
  const adapter = new AppPlusTcbRequest();
  let fileReads = 0;
  let cloudCalls = 0;
  const instance = {
    async uploadFile(options) {
      assert.equal(options.method, 'post', `${platform} must request a form upload`);
      const response = await adapter.upload({
        url: 'https://storage.example/upload',
        file: options.filePath,
        name: options.cloudPath,
        data: { key: options.cloudPath, success_action_status: '201' }
      });
      assert.equal(response.statusCode, 201, 'CloudBase expects POST success status');
      return { fileID };
    }
  };
  const { uploadFileCompat } = loadUploadCompat({
    getCurrentPlatform: () => platform,
    getCloudFunctionMethod: () => 'tcb',
    getApp: () => ({ $tcb: instance }),
    uni,
    readFileAsBase64: async () => { fileReads += 1; throw new Error('文件系统API不可用'); },
    cloudCall: async () => { cloudCalls += 1; throw new Error('unexpected fallback'); }
  });
  const result = await uploadFileCompat({ cloudPath, filePath });
  assert.equal(result.fileID, fileID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'file', 'COS expects the multipart file field to be named file');
  assert.equal(calls[0].filePath, filePath);
  assert.equal(calls[0].formData.key, cloudPath);
  assert.equal(fileReads, 0, 'successful App upload must not enter the filesystem fallback');
  assert.equal(cloudCalls, 0);
}

async function testRegistrationAvatar() {
  const vue = fs.readFileSync(path.join(root, 'pages/register/register.vue'), 'utf8');
  const source = vue.match(/<script>([\s\S]*?)<\/script>/)[1];
  const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const methods = declaration.properties.find(node => node.key.name === 'methods').value;
  const method = methods.properties.find(node => node.key.name === 'uploadAvatarFile');
  assert.ok(method, 'registration avatar upload method must exist');
  let uploadOptions;
  const page = vm.runInNewContext(`({ ${source.slice(method.start, method.end)} })`, {
    uploadFileCompat: async options => { uploadOptions = options; return { fileID }; },
    getCurrentPlatform: () => 'app',
    Date, Math
  });
  assert.equal(await page.uploadAvatarFile(filePath), fileID);
  assert.equal(uploadOptions.filePath, filePath);
  assert.equal(uploadOptions.context, page);
  assert.equal(uploadOptions.requireAuth, true);
  assert.match(uploadOptions.cloudPath, /^user_avatars\/\d+_\d+\.jpg$/);

  let cloudPayload;
  const miniProgramPage = vm.runInNewContext(`({ ${source.slice(method.start, method.end)} })`, {
    getCurrentPlatform: () => 'mp-weixin',
    readFileAsBase64: async () => 'base64-fixture',
    uploadFileCompat: () => { throw new Error('mini program must retain the cloud function flow'); },
    Date, Math
  });
  miniProgramPage.callCloudFunction = async (name, payload) => {
    assert.equal(name, 'upload');
    cloudPayload = payload;
    return { result: { success: true, fileID } };
  };
  assert.equal(await miniProgramPage.uploadAvatarFile(filePath), fileID);
  assert.equal(cloudPayload.fileContent, 'base64-fixture');
}

async function testAppWebViewFileRead() {
  const plus = { io: {
    resolveLocalFileSystemURL(path, success) { success({ file: callback => callback({ path }) }); },
    FileReader: class {
      readAsDataURL() { this.onload({ target: { result: 'data:image/jpeg;base64,YXZhdGFy' } }); }
    }
  } };
  const globals = {
    plus, window: {}, document: {},
    getSystemInfoCompat: () => ({ platform: 'android', uniPlatform: 'app' }),
    uni: { getFileSystemManager() { throw new Error('App must not use the mini program file manager'); } },
    fetch() { throw new Error('App must not fetch a local file as H5'); }
  };
  const detector = loadFunctions('utils/platformDetector.js', globals, ['getCurrentPlatform']);
  assert.equal(detector.getCurrentPlatform(), 'app');
  const harmonyDetector = loadFunctions('utils/platformDetector.js', {
    ...globals,
    getSystemInfoCompat: () => ({ platform: 'harmony', uniPlatform: 'app-harmony' })
  }, ['getCurrentPlatform']);
  assert.equal(harmonyDetector.getCurrentPlatform(), 'app-harmony');
  const reader = loadFunctions('utils/fileReader.js', globals, ['readFileAsBase64']);
  assert.equal(await reader.readFileAsBase64(filePath), 'YXZhdGFy');
}

async function main() {
  await testApp('app');
  await testApp('app-harmony');
  await testRegistrationAvatar();
  await testAppWebViewFileRead();
  console.log('PASS App avatar upload: CloudBase POST, COS file field, no filesystem fallback');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
