const indexName = 'users_poem_id_unique';
const messages = {
  POEM_ID_EXISTS: '该 Poem ID 已被使用，请选择其他 ID',
  INVALID_POEM_ID: '请输入有效的 Poem ID'
};

function poemIdError(code) {
  return Object.assign(new Error(messages[code]), { code });
}

function normalizePoemId(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !value.trim()) throw poemIdError('INVALID_POEM_ID');
  return value.trim();
}

async function assertAvailable(db, poemId, ownUserId) {
  async function hasOtherUser(field) {
    const { data } = await db.collection('users').where({ [field]: poemId }).limit(ownUserId ? 2 : 1).get();
    return ownUserId ? data.some(user => user._id !== ownUserId) : data.length > 0;
  }

  // 旧版身份查询也会识别小写字段 poemid。
  if (await hasOtherUser('poemId') || await hasOtherUser('poemid')) {
    throw poemIdError('POEM_ID_EXISTS');
  }
}

function isDuplicateKey(error) {
  const details = [error?.code, error?.errCode, error?.message, error?.errMsg].join(' ');
  return [error?.code, error?.errCode].some(code => String(code) === '11000') ||
    /E11000|duplicate[_\s]*key/i.test(details);
}

function isPoemIdIndexConflict(error) {
  const details = [error?.message, error?.errMsg].join(' ');
  return isDuplicateKey(error) && (error.keyPattern?.poemId === 1 || details.includes(indexName));
}

async function saveWithPoemIdCheck(db, poemId, ownUserId, save) {
  if (!poemId) return save();
  await assertAvailable(db, poemId, ownUserId);
  try {
    return await save();
  } catch (error) {
    // 唯一索引覆盖查重之后、写入之前发生的并发抢占。
    if (isPoemIdIndexConflict(error)) throw poemIdError('POEM_ID_EXISTS');
    if (isDuplicateKey(error)) await assertAvailable(db, poemId, ownUserId);
    throw error;
  }
}

function poemIdFailure(error) {
  if (!Object.prototype.hasOwnProperty.call(messages, error?.code)) return null;
  return { success: false, code: error.code, message: messages[error.code] };
}

module.exports = { indexName, normalizePoemId, saveWithPoemIdCheck, poemIdFailure, isPoemIdIndexConflict };
