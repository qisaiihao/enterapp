<template>
  <view class="privacy-page" :data-app-theme="appThemeMode" :style="[appThemeVars, readFontVars]">
    <view class="privacy-header">
      <view class="privacy-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="privacy-title">隐私政策</text>
    </view>


    <view class="privacy-content">
      <text class="privacy-meta" selectable :user-select="true">更新日期：2026年10月10日</text>
      <text class="privacy-meta" selectable :user-select="true">生效日期：2026年10月9日</text>

      <text class="privacy-paragraph" selectable :user-select="true">广州回车键网络科技有限公司（以下简称“我们”）是“回车键”（英文名 Poementer，以下简称“本应用”）的运营者。我们深知个人信息对您的重要性，将按照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》等法律法规的要求，采取相应的安全保护措施，尽力保护您的个人信息安全可控。</text>
      <text class="privacy-paragraph" selectable :user-select="true">请您在使用本应用前，仔细阅读并充分理解本隐私政策。本政策将帮助您了解以下内容：我们如何收集和使用您的个人信息、系统权限的调用、信息的共享与披露、信息的存储与保护、您的权利、未成年人保护、第三方服务以及本政策的更新方式。</text>

      <text class="privacy-heading" selectable :user-select="true">一、我们如何收集和使用您的个人信息</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 账号注册与登录：您使用手机号注册、登录、找回密码时，我们会收集您的手机号；您使用账号密码登录时，我们会收集您的账号标识；您使用第三方登录时，微信会向我们提供您的用户标识（openid），GitHub 会向我们提供您的用户名、头像及公开邮箱等授权信息。上述信息仅用于完成登录与账号绑定。</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 个人资料：您可主动填写昵称、头像、生日、个人简介、签名图片等信息，用于展示您的个人主页。</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 创作内容：您发布的诗歌、讨论、评论、回复、图片、标签，以及作品集、收藏夹等信息，将存储在我们的服务器中，用于向您及平台其他用户展示。</text>
      <text class="privacy-paragraph" selectable :user-select="true">4. 设备与日志信息：为保障服务正常运行与账号安全，我们可能收集设备型号、操作系统版本、网络状态、应用版本号、异常日志等信息。</text>

      <text class="privacy-heading" selectable :user-select="true">二、系统权限的调用</text>
      <text class="privacy-paragraph" selectable :user-select="true">在您使用相关功能时，我们可能向您申请以下权限：</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 相机：用于拍摄头像、诗图或拼贴素材；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 相册与存储：用于选择图片上传，以及保存图片、诗卡到相册；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 电话状态：用于运营商一键登录时的本机号码认证；</text>
      <text class="privacy-paragraph" selectable :user-select="true">4. 网络与 Wi-Fi 状态：用于判断网络情况并加载内容；</text>
      <text class="privacy-paragraph" selectable :user-select="true">5. 震动：用于部分操作的触感反馈；</text>
      <text class="privacy-paragraph" selectable :user-select="true">6. 应用安装：用于 Android 端应用内版本更新安装。</text>
      <text class="privacy-paragraph" selectable :user-select="true">您可以在系统设置中随时关闭上述权限；关闭后对应的功能可能无法使用，但不影响其他功能的正常使用。</text>

      <text class="privacy-heading" selectable :user-select="true">三、我们如何使用您的个人信息</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 提供、维护和改进本应用的功能与服务；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 用于账号安全、内容审核和风险防范，维护良好的平台环境；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 在法律法规允许的范围内，用于统计分析，以改进产品体验；</text>
      <text class="privacy-paragraph" selectable :user-select="true">4. 经您同意的其他用途。</text>

      <text class="privacy-heading" selectable :user-select="true">四、我们如何共享、转让、公开披露您的个人信息</text>
      <text class="privacy-paragraph" selectable :user-select="true">我们不会出售您的个人信息。仅在以下情形下共享：</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 已取得您的明确同意；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 为提供必要服务而与服务商共享（如云服务、短信验证码、登录认证、内容安全检测、图像文字识别等）；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 依据法律法规、司法或行政机关的强制性要求。</text>
      <text class="privacy-paragraph" selectable :user-select="true">我们不会转让或公开披露您的个人信息，法律法规另有规定或取得您同意的除外。</text>

      <text class="privacy-heading" selectable :user-select="true">五、我们如何存储和保护您的个人信息</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 您的个人信息存储于中华人民共和国境内的云服务器；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 我们采用 HTTPS 加密传输、访问权限控制等措施保护您的个人信息；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 我们仅在为您提供服务所必需的期限内保存您的个人信息。账号注销后，我们将删除或匿名化处理您的个人信息，法律法规另有规定的除外。</text>

      <text class="privacy-heading" selectable :user-select="true">六、您的权利</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 查询与更正：您可以在“我－编辑资料”中查询和更正您的个人资料；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 删除：您可以删除自己发布的作品、评论等内容；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 撤回同意：您可以在系统设置中关闭相机、相册等权限；</text>
      <text class="privacy-paragraph" selectable :user-select="true">4. 注销账号：您可以在“设置－注销账号”中申请注销账号。注销后，您的账号资料、收藏、关注、消息、草稿等数据将被删除，已发布的诗歌、讨论和评论将匿名化保留并显示为“已注销用户”；</text>
      <text class="privacy-paragraph" selectable :user-select="true">5. 投诉举报：如您认为您的个人信息权利受到侵害，可以通过下方联系方式联系我们。</text>

      <text class="privacy-heading" selectable :user-select="true">七、未成年人保护</text>
      <text class="privacy-paragraph" selectable :user-select="true">本应用主要面向成年人。若您为不满十四周岁的未成年人，请在监护人的陪同下阅读本政策，并在取得监护人同意后使用本应用。我们不会主动收集未成年人的个人信息；如发现相关情况，我们将依法删除。</text>

      <text class="privacy-heading" selectable :user-select="true">八、第三方服务</text>
      <text class="privacy-paragraph" selectable :user-select="true">本应用接入了以下第三方服务，其个人信息处理行为适用各自的隐私政策：</text>
      <text class="privacy-paragraph" selectable :user-select="true">1. 腾讯云开发（CloudBase）：提供云函数、云数据库、云存储服务；</text>
      <text class="privacy-paragraph" selectable :user-select="true">2. 微信开放平台：提供微信登录及内容安全能力；</text>
      <text class="privacy-paragraph" selectable :user-select="true">3. 运营商一键登录服务：提供手机号一键登录及号码认证；</text>
      <text class="privacy-paragraph" selectable :user-select="true">4. GitHub：提供第三方账号登录（可选）；</text>
      <text class="privacy-paragraph" selectable :user-select="true">5. 短信服务商：用于向您发送验证码短信。</text>
      <text class="privacy-paragraph" selectable :user-select="true">我们仅会出于本政策所述目的，与上述服务商共享必要的信息。</text>

      <text class="privacy-heading" selectable :user-select="true">九、本政策的更新</text>
      <text class="privacy-paragraph" selectable :user-select="true">本政策可能适时更新。更新后，我们会在本页面公布最新版本并标注更新日期；涉及重大变更时，我们将以适当方式（如弹窗、公告）另行提示。</text>

      <text class="privacy-heading" selectable :user-select="true">十、联系我们</text>
      <text class="privacy-paragraph" selectable :user-select="true">如您对本政策或个人信息保护有任何问题、意见或建议，可以通过以下方式联系我们：</text>
      <text class="privacy-paragraph" selectable :user-select="true">运营主体：广州回车键网络科技有限公司</text>
      <text class="privacy-paragraph" selectable :user-select="true">联系邮箱：poementer@yeah.net</text>
      <text class="privacy-paragraph" selectable :user-select="true">您也可以通过本应用中的“联系我们”入口与我们联系。我们将在收到您的反馈后尽快处理，并在十五个工作日内予以回复。</text>
    </view>
  </view>
  <app-overlay-host />
</template>

<script>
export default {
  methods: {
    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
};
</script>

<style scoped>
.privacy-page {
  min-height: 100vh;
  background: var(--app-page-bg, #ffffff);
  color: var(--app-primary-text, #111111);
  box-sizing: border-box;
}

.privacy-header {
  position: relative;
  height: calc(var(--app-safe-area-top, 0px) + 88rpx);
  padding-top: var(--app-safe-area-top, 0px);
  box-sizing: border-box;
  background: var(--app-surface-bg, #ffffff);
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.privacy-back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.privacy-title {
  position: absolute;
  left: 120rpx;
  right: 120rpx;
  bottom: 24rpx;
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: var(--app-primary-text, #000000);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.privacy-content {
  padding: 36rpx 40rpx 80rpx;
  box-sizing: border-box;
}

.privacy-meta {
  display: block;
  font-size: 24rpx;
  line-height: 38rpx;
  color: var(--app-muted-text, #999999);
}

.privacy-heading {
  display: block;
  margin: 44rpx 0 16rpx;
  font-size: 30rpx;
  line-height: 44rpx;
  font-weight: 600;
  color: var(--app-primary-text, #111111);
}

.privacy-paragraph {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 48rpx;
  color: var(--app-primary-text, #333333);
  overflow-wrap: anywhere;
}
</style>
