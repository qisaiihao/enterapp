// Administrative setup uses the existing CLI login; never prints/copies credentials.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const globalRoot = process.env.CLOUDBASE_GLOBAL_ROOT || (process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules') : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim());
const cliRoot = path.join(globalRoot, '@cloudbase/cli');
const { authSupevisor } = require(path.join(cliRoot, 'lib/utils/auth.js'));
const CloudBase = require(path.join(cliRoot, 'node_modules/@cloudbase/manager-node'));
const envId = 'cloud1-5gb0pbyl400845f5';

async function main() {
  const auth = await authSupevisor.getLoginState();
  if (!auth?.secretId || !auth?.secretKey) throw new Error('请先执行 tcb login');
  const manager = new CloudBase({ envId, secretId: auth.secretId, secretKey: auth.secretKey, token: auth.token });
  const command = process.argv[2] || 'inspect';
  if (command === 'setup') {
    for (const name of ['collage_ocr_usage', 'collage_ocr_cache']) {
      await manager.database.createCollectionIfNotExists(name);
      await manager.commonService().call({ Action: 'ModifyDatabaseACL', Param: { EnvId: envId, CollectionName: name, AclTag: 'ADMINONLY' } });
      console.log(`${name}: ready, server access only`);
    }
  } else if (command === 'setup-role') {
    const cam = manager.commonService('cam', '2019-01-16');
    const roleName = 'PoementerCollageOcrRole', policyName = 'PoementerCollageOcrInvoke';
    try { await cam.call({ Action: 'GetRole', Param: { RoleName: roleName } }); }
    catch (error) {
      if (!/notexist|notfound|not exist|not found/i.test(`${error.code} ${error.message}`)) throw error;
      await cam.call({ Action: 'CreateRole', Param: {
        RoleName: roleName, Description: 'Poementer collage OCR function execution role',
        PolicyDocument: JSON.stringify({ version: '2.0', statement: [{ effect: 'allow', action: 'name/sts:AssumeRole', principal: { service: ['scf.qcloud.com'] } }] })
      } });
    }
    const policies = await cam.call({ Action: 'ListPolicies', Param: { Scope: 'Local', Keyword: policyName, Rp: 100 } });
    let policyId = policies.List?.find(p => p.PolicyName === policyName)?.PolicyId;
    if (!policyId) {
      const result = await cam.call({ Action: 'CreatePolicy', Param: {
        PolicyName: policyName, Description: 'Invoke GeneralAccurateOCR only',
        PolicyDocument: JSON.stringify({ version: '2.0', statement: [{ effect: 'allow', action: ['ocr:GeneralAccurateOCR'], resource: ['*'] }] })
      } });
      policyId = result.PolicyId;
    }
    // Preserve the same CloudBase permissions the function already had, but put
    // the extra OCR permission on a dedicated role, not the shared TCB role.
    const baseline = await cam.call({ Action: 'ListAttachedRolePolicies', Param: { RoleName: 'TCB_QcsRole', Page: 1, Rp: 100 } });
    for (const id of [...(baseline.List || []).map(p => p.PolicyId), policyId]) {
      await cam.call({ Action: 'AttachRolePolicy', Param: { AttachRoleName: roleName, PolicyId: id } });
    }
    await manager.commonService('scf').call({ Action: 'UpdateFunctionConfiguration', Param: { FunctionName: 'collageOcr', Namespace: envId, Role: roleName } });
    console.log('collageOcr: dedicated execution role configured; OCR enable flag unchanged');
  } else if (command === 'enable') {
    const info = await manager.functions.getFunctionDetail('collageOcr');
    const variables = (info.Environment?.Variables || []).map(({ Key, Value }) => ({ Key, Value }));
    const flag = variables.find(variable => variable.Key === 'COLLAGE_OCR_ENABLED');
    if (flag) flag.Value = 'true';
    else variables.push({ Key: 'COLLAGE_OCR_ENABLED', Value: 'true' });
    await manager.commonService('scf').call({ Action: 'UpdateFunctionConfiguration', Param: {
      FunctionName: 'collageOcr', Namespace: envId, Timeout: 60, Environment: { Variables: variables }
    } });
    console.log('collageOcr: OCR enabled, timeout 60 seconds; existing environment variables preserved; code not redeployed');
  } else if (command === 'inspect-role') {
    const info = await manager.functions.getFunctionDetail('collageOcr');
    const cam = manager.commonService('cam', '2019-01-16');
    const role = await cam.call({ Action: 'GetRole', Param: { RoleName: info.Role } });
    const attached = await cam.call({ Action: 'ListAttachedRolePolicies', Param: { RoleName: role.RoleInfo.RoleName, Page: 1, Rp: 100 } });
    console.log(JSON.stringify({ role: info.Role, policies: attached.List?.map(p => ({ id: p.PolicyId, name: p.PolicyName })) }, null, 2));
    for (const policy of attached.List || []) {
      const detail = await cam.call({ Action: 'GetPolicy', Param: { PolicyId: policy.PolicyId } });
      let document;
      try { document = JSON.parse(decodeURIComponent(detail.PolicyDocument)); } catch (_) { document = JSON.parse(detail.PolicyDocument); }
      // Output only OCR-related permissions, never account policy contents wholesale.
      const relevant = (document.statement || []).filter(s => JSON.stringify(s.action).toLowerCase().includes('ocr') || s.action === '*' || (Array.isArray(s.action) && s.action.includes('*')));
      console.log(JSON.stringify({ policy: policy.PolicyName, ocrStatements: relevant }));
    }
  } else if (command === 'health') {
    // Direct administrative invocation has no end-user identity. AUTH_REQUIRED
    // proves the deployed handler loads and rejects unauthenticated OCR calls.
    const result = await manager.functions.invokeFunction('collageOcr', { action: 'status' });
    const response = result.Result || result;
    console.log(JSON.stringify({ invokeCode: response.InvokeResult, result: response.RetMsg }, null, 2));
  } else if (command === 'inspect') {
    const info = await manager.functions.getFunctionDetail('collageOcr');
    const variables = info.Environment?.Variables || [];
    console.log(JSON.stringify({ name: info.FunctionName, status: info.Status, role: info.Role, timeout: info.Timeout, configuration: variables.filter(v => v.Key.startsWith('COLLAGE_')), credentialKeysConfigured: variables.some(v => v.Key === 'OCR_SECRET_ID') }, null, 2));
    for (const name of ['collage_ocr_usage', 'collage_ocr_cache']) {
      const exists = await manager.database.checkCollectionExists(name);
      console.log(`${name}: ${exists.Exists ? 'exists' : 'missing'}`);
    }
  } else {
    throw new Error('支持 inspect、inspect-role、setup、setup-role、enable、health');
  }
}
main().catch(error => { console.error(error.code || error.name, error.message); process.exitCode = 1; });
