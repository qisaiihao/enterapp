'use strict';

const {
  SmsProviderFactory,
  loadSmsConfig,
  generateVerificationCode,
  validatePhone,
  successResponse,
  errorResponse,
  checkRateLimit,
  saveSmsCode,
  logSmsSuccess,
  logSmsError
} = require('sms-service');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const { phone, scene = 'binding' } = event;
  const clientIP = context.CLIENTIP || '';

  try {
    console.log('📱 [sendSmsCode] 开始处理短信发送请求');
    console.log('📱 [sendSmsCode] 手机号:', phone ? phone.substring(0, 3) + '****' : '未提供');
    console.log('📱 [sendSmsCode] 场景:', scene);

    // 1. 参数验证
    if (!phone) {
      return errorResponse('请输入手机号', 1001);
    }

    if (!scene) {
      return errorResponse('请指定使用场景', 1002);
    }

    // 2. 手机号格式验证
    if (!validatePhone(phone)) {
      return errorResponse('手机号格式不正确', 1003);
    }

    // 3. 场景有效性验证
    const validScenes = ['binding', 'updatePhone', 'resetPassword'];
    if (!validScenes.includes(scene)) {
      return errorResponse(`不支持的场景: ${scene}，支持的场景: ${validScenes.join(', ')}`, 1004);
    }

    // 4. 频率限制检查
    const rateLimitResult = await checkRateLimit(phone, clientIP, db);
    if (!rateLimitResult.allowed) {
      console.log('📱 [sendSmsCode] 频率限制:', rateLimitResult.message);
      return errorResponse(rateLimitResult.message, 2001);
    }

    // 5. 加载配置
    let config;
    try {
      config = loadSmsConfig('./config.json');
    } catch (configError) {
      console.error('📱 [sendSmsCode] 配置加载失败:', configError);
      return errorResponse('系统配置错误，请联系管理员', 5001);
    }

    // 6. 生成验证码
    const code = generateVerificationCode(config.testMode);
    console.log('📱 [sendSmsCode] 验证码已生成');

    // 7. 获取短信服务商并发送
    let provider;
    try {
      provider = SmsProviderFactory.createProvider(config);
    } catch (providerError) {
      console.error('📱 [sendSmsCode] 服务商创建失败:', providerError);
      return errorResponse('短信服务初始化失败', 5002);
    }

    const sendResult = await provider.sendVerificationCode(phone, code, scene);

    // 8. 处理发送结果
    if (!sendResult.success) {
      // 记录失败日志
      await logSmsError(phone, scene, provider.getProviderName(), sendResult, clientIP, db);
      
      console.error('📱 [sendSmsCode] 发送失败:', sendResult.message);
      return errorResponse(`发送失败: ${sendResult.message}`, 3001);
    }

    // 9. 存储验证码到数据库
    try {
      await saveSmsCode({
        phone,
        code,
        scene,
        ip: clientIP
      }, db);
    } catch (dbError) {
      console.error('📱 [sendSmsCode] 数据库保存失败:', dbError);
      // 短信已发送，数据库失败不影响用户体验
    }

    // 10. 记录成功日志
    await logSmsSuccess(phone, scene, provider.getProviderName(), sendResult, clientIP, db);

    console.log('✅ [sendSmsCode] 短信发送成功');

    // 11. 返回成功响应
    return successResponse('验证码已发送，请注意查收', {
      phone: phone,
      expireTime: 5 * 60, // 5分钟，单位秒
      remainTime: 60 // 下次可发送间隔，单位秒
    });

  } catch (error) {
    console.error('📱 [sendSmsCode] 系统异常:', error);
    return errorResponse('系统错误，请稍后重试', 5000);
  }
};