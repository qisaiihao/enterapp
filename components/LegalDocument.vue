<template>
  <view v-if="isUserAgreement" class="legal-document">
    <view v-for="section in userAgreement" :key="section.heading">
      <text v-if="section.heading" class="legal-heading" :selectable="selectable" :user-select="selectable">{{ section.heading }}</text>
      <text
        v-for="paragraph in section.paragraphs"
        :key="paragraph.text"
        class="legal-paragraph"
        :class="{ 'legal-paragraph--important': paragraph.important }"
        :selectable="selectable" :user-select="selectable"
      >{{ paragraph.text }}</text>
    </view>
  </view>
  <view v-else class="legal-document">
    <text class="legal-meta" :selectable="selectable" :user-select="selectable">更新日期：2026年11月23日</text>
    <text class="legal-meta" :selectable="selectable" :user-select="selectable">生效日期：2026年11月23日</text>

    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">广州回车键网络科技有限公司（以下简称“我们”）是“回车键”（英文名 Poementer，以下简称“本应用”）的运营者。我们深知个人信息对您的重要性，将按照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》等法律法规的要求，采取相应的安全保护措施，尽力保护您的个人信息安全可控。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">请您在使用本应用前，仔细阅读并充分理解本隐私政策。本政策将帮助您了解以下内容：我们如何收集和使用您的个人信息、系统权限的调用、信息的共享与披露、信息的存储与保护、您的权利、未成年人保护、第三方服务以及本政策的更新方式。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">一、我们如何收集和使用您的个人信息</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 账号注册与登录：您使用手机号注册、登录、找回密码时，我们会收集您的手机号；您使用账号密码登录时，我们会收集您的账号标识；您使用第三方登录时，微信会向我们提供您的用户标识（openid），GitHub 会向我们提供您的用户名、头像及公开邮箱等授权信息。上述信息用于完成登录与账号绑定。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 个人资料：您可主动填写昵称、头像、生日、个人简介、签名图片等信息，用于展示您的个人主页。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 创作内容：您发布的诗歌、讨论、评论、回复、图片、标签，以及作品集、收藏夹等信息，将存储在我们的服务器中，用于向您及平台其他用户展示。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">4. 设备与日志信息：为保障服务正常运行与账号安全，我们可能收集设备型号、操作系统版本、网络状态、应用版本号、异常日志等信息。登录成功时，我们会记录账号标识、登录时间、登录方式、使用端、设备和版本信息、浏览器用户代理，以及云平台能够提供的 IP 地址和源端口，用于账号安全、安全审计和网安备案。具体字段以设备环境和云平台实际提供的信息为准。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">5. 设备标识符：本应用使用 DCloud uni-app 运行框架。为区分设备、保障账号安全、排查崩溃与兼容性问题，框架在获取设备信息时可能读取设备标识符（HarmonyOS 上为 OAID，审核报告中可能表述为 IMEI）。我们不会将其用于广告追踪，也不会将其与您的真实身份直接关联；该类标识符仅在您同意本政策后读取，您拒绝同意时我们不会读取。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">二、系统权限的调用</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">在您使用相关功能时，我们可能向您申请以下权限：</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 相机：用于拍摄头像、诗图或拼贴素材；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 相册与存储：用于选择图片上传，以及保存图片、诗卡到相册；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 电话状态：用于运营商一键登录时的本机号码认证；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">4. 网络与 Wi-Fi 状态：用于判断网络情况并加载内容；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">5. 震动：用于部分操作的触感反馈；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">6. 应用安装：用于 Android 端应用内版本更新安装。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">您可以在系统设置中随时关闭上述权限；关闭后对应的功能可能无法使用，但不影响其他功能的正常使用。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">三、我们如何使用您的个人信息</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 提供、维护和改进本应用的功能与服务；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 用于账号安全、内容审核和风险防范，维护良好的平台环境；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 在法律法规允许的范围内，用于统计分析，以改进产品体验；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">4. 经您同意的其他用途。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">四、我们如何共享、转让、公开披露您的个人信息</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">我们不会出售您的个人信息。仅在以下情形下共享：</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 已取得您的明确同意；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 为提供必要服务而与服务商共享（如云服务、短信验证码、登录认证、内容安全检测、图像文字识别等）；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 依据法律法规、司法或行政机关的强制性要求。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">我们不会转让或公开披露您的个人信息，法律法规另有规定或取得您同意的除外。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">五、我们如何存储和保护您的个人信息</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 您的个人信息存储于中华人民共和国境内的云服务器；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 我们采用 HTTPS 加密传输、访问权限控制等措施保护您的个人信息；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 我们仅在提供服务、保障账号安全与开展安全审计所必需的期限内保存您的个人信息。账号注销后，我们将删除您的账号资料、发布内容及相关个人信息和上传文件，同时清理本应用内保存的个人资料、草稿及账号缓存。用于安全审计和网安备案的登录日志除外，注销后仍保留，仅授权管理员可在后台访问。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">六、您的权利</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 查询与更正：您可以在“我－编辑资料”中查询和更正您的个人资料；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 删除：您可以删除自己发布的作品、评论等内容；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 撤回同意：您可以在系统设置中关闭相机、相册等权限；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">4. 注销账号：您可以在“设置－注销账号”中验证身份并确认注销。注销后，您的账号资料、登录方式、已发布的诗歌和讨论、评论和回复、作品集、收藏、关注、消息、草稿及上传文件等信息将被永久删除且无法恢复。用于安全审计和网安备案的登录日志仍保留，仅授权管理员可在后台访问；同一手机号或 Poem ID 可重新注册；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">5. 投诉举报：如您认为您的个人信息权利受到侵害，可以通过下方联系方式联系我们。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">七、未成年人保护</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">本应用主要面向成年人。若您为不满十四周岁的未成年人，请在监护人的陪同下阅读本政策，并在取得监护人同意后使用本应用。我们不会主动收集未成年人的个人信息；如发现相关情况，我们将依法删除。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">八、第三方服务</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">本应用接入了以下第三方服务，其个人信息处理行为适用各自的隐私政策：</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">1. 腾讯云开发（CloudBase）：提供云函数、云数据库、云存储服务；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">2. 微信开放平台：提供微信登录及内容安全能力；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">3. 运营商一键登录服务：提供手机号一键登录及号码认证；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">4. GitHub：提供第三方账号登录（可选）；</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">5. 短信服务商：用于向您发送验证码短信。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">6. DCloud uni-app 运行框架：提供跨端运行环境；为区分设备与排查兼容性问题，可能读取设备标识符（HarmonyOS 上为 OAID），其处理目的与方式见本政策第一条。</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">我们仅会出于本政策所述目的，与上述服务商共享必要的信息。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">九、本政策的更新</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">本政策可能适时更新。更新后，我们会在本页面公布最新版本并标注更新日期；涉及重大变更时，我们将以适当方式（如弹窗、公告）另行提示。</text>

    <text class="legal-heading" :selectable="selectable" :user-select="selectable">十、联系我们</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">如您对本政策或个人信息保护有任何问题、意见或建议，可以通过以下方式联系我们：</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">运营主体：广州回车键网络科技有限公司</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">联系邮箱：poementer@yeah.net</text>
    <text class="legal-paragraph" :selectable="selectable" :user-select="selectable">您也可以通过本应用中的“联系我们”入口与我们联系。我们将在收到您的反馈后尽快处理，并在十五个工作日内予以回复。</text>
  </view>
</template>

<script>
import userAgreement from '@/pages/privacy/user-agreement.js';

export default {
  name: 'LegalDocument',
  props: {
    isUserAgreement: Boolean,
    selectable: { type: Boolean, default: true }
  },
  data() {
    return { userAgreement };
  }
};
</script>

<style scoped>
.legal-meta {
  display: block;
  font-size: 24rpx;
  line-height: 38rpx;
  color: var(--legal-muted, var(--app-muted-text, #999999));
}

.legal-heading {
  display: block;
  margin: 44rpx 0 16rpx;
  font-size: 30rpx;
  line-height: 44rpx;
  font-weight: 600;
}

.legal-paragraph {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 48rpx;
  overflow-wrap: anywhere;
}

.legal-paragraph--important {
  font-weight: 600;
}
</style>
