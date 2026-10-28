const failure = (code, message, extra = {}) => Object.assign({ success: false, code, message }, extra);
const hasPassword = user => !!(user.password || user.passwordHash);

async function handlePasswordAction(database, openid, event) {
  const isStatus = event.action === 'getPasswordStatus';
  if (typeof openid !== 'string' || !openid.trim()) {
    return failure('NO_OPENID', '无法获取用户身份信息，请重新登录');
  }
  if (!isStatus) {
    if (!['set', 'change'].includes(event.mode)) {
      return failure('INVALID_PASSWORD_MODE', '请重新打开密码设置后重试');
    }
    const password = event.newPassword;
    if (typeof password !== 'string' || password.length < 6 || password.length > 32 || password !== password.trim()) {
      return failure('INVALID_PASSWORD', '新密码需为6–32位，首尾不能有空格');
    }
  }

  try {
    const candidates = await database.collection('users').where({ _openid: openid }).limit(2).get();
    if (!candidates.data || candidates.data.length === 0) {
      return failure('USER_NOT_FOUND', '账号不存在，请重新登录');
    }
    if (candidates.data.length !== 1) {
      return failure('AMBIGUOUS_ACCOUNT', '账号信息重复，请联系管理员处理');
    }
    const candidate = candidates.data[0];
    if (isStatus) return { success: true, hasPassword: hasPassword(candidate) };

    // 状态判断与写入在同一事务内完成，首次设置不能覆盖并发写入的密码。
    return await database.runTransaction(async transaction => {
      const userRef = transaction.collection('users').doc(candidate._id);
      const { data: user } = await userRef.get();
      if (!user || user._openid !== openid) {
        return failure('USER_NOT_FOUND', '账号信息已变化，请重新登录');
      }
      const passwordExists = hasPassword(user);
      if (event.mode === 'set' && passwordExists) {
        return failure('PASSWORD_ALREADY_SET', '账号已设置密码，请验证原密码后修改', { hasPassword: true });
      }
      if (event.mode === 'change' && !passwordExists) {
        return failure('PASSWORD_NOT_SET', '账号尚未设置密码，请直接设置', { hasPassword: false });
      }
      if (passwordExists) {
        // 当前密码登录使用 password 字段；未知哈希格式须走短信找回，不能按无密码处理。
        if (typeof user.password !== 'string' || !user.password) {
          return failure('PASSWORD_RESET_REQUIRED', '请通过登录页的忘记密码使用短信重置密码', { hasPassword: true });
        }
        if (typeof event.oldPassword !== 'string' || !event.oldPassword) {
          return failure('OLD_PASSWORD_REQUIRED', '请输入原密码', { hasPassword: true });
        }
        if (event.oldPassword !== user.password) {
          return failure('INVALID_OLD_PASSWORD', '原密码错误，请重新输入', { hasPassword: true });
        }
      }
      await userRef.update({ data: { password: event.newPassword, passwordUpdatedAt: new Date() } });
      return {
        success: true,
        hasPassword: true,
        message: passwordExists ? '密码修改成功' : '密码设置成功'
      };
    });
  } catch (error) {
    // 只记录错误码，数据库异常可能带有包含密码的请求详情。
    console.error('[updateUserProfile] 密码操作失败:', error.code || 'SYSTEM_ERROR');
    return failure(isStatus ? 'PASSWORD_STATUS_FAILED' : 'PASSWORD_UPDATE_FAILED',
      isStatus ? '密码状态加载失败，请稍后重试' : '密码保存失败，请稍后重试');
  }
}

module.exports = { handlePasswordAction };
