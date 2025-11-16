<template>
	<view class="callback-container">
		<view class="loading-box">
			<view class="spinner"></view>
			<text class="loading-text">{{ loadingText }}</text>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			loadingText: '正在处理登录信息...'
		};
	},
	
	onLoad(options) {
		console.log('🔗 [H5回调] 页面加载，URL参数:', options);
		console.log('🔗 [H5回调] 完整URL:', window.location.href);
		console.log('🔗 [H5回调] URL hash:', window.location.hash);
		console.log('🔗 [H5回调] URL search:', window.location.search);
		this.handleCallback(options);
	},
	
	methods: {
		handleCallback(options) {
			const type = options.type;
			const encodedData = options.data;
			
			if (!type || !encodedData) {
				console.error('❌ [H5回调] 无效的回调参数');
				uni.showToast({ 
					title: '无效的回调参数', 
					icon: 'none' 
				});
				setTimeout(() => {
					uni.reLaunch({ url: '/pages/login/login' });
				}, 1500);
				return;
			}
			
			try {
				// 解码并解析数据
				const data = JSON.parse(decodeURIComponent(encodedData));
				console.log('✅ [H5回调] 成功解析数据:', data);
				
				if (type === 'register') {
					// 新用户注册
					this.loadingText = '欢迎新用户！正在跳转注册页面...';
					console.log('📝 [H5回调] 新用户，跳转到注册页面');
					
					// 保存 GitHub 数据
					uni.setStorageSync('github_temp_data', data);
					
					setTimeout(() => {
						uni.reLaunch({
							url: `/pages/register/register?fromGithub=true&githubData=${encodeURIComponent(JSON.stringify(data))}`
						});
					}, 500);
					
				} else if (type === 'login') {
					// 已注册用户登录
					this.loadingText = '登录成功！正在跳转...';
					console.log('✅ [H5回调] 已注册用户，处理登录');
					
					const userInfo = data.user;
					
					// 保存用户信息
					uni.setStorageSync('userInfo', userInfo);
					uni.setStorageSync('github_access_token', data.accessToken);
					
					// 更新全局状态
					const app = getApp();
					if (app) {
						app.globalData = app.globalData || {};
						app.globalData.userInfo = userInfo;
						app.globalData.openid = userInfo._openid || userInfo.openid;
						app.globalData._loginProcessCompleted = true;
					}
					
					uni.showToast({ 
						title: '登录成功！', 
						icon: 'success' 
					});
					
					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/poem-square/poem-square'
						});
					}, 1000);
					
				} else if (type === 'error') {
					// 错误处理
					console.error('❌ [H5回调] GitHub登录失败:', data.message);
					const errorMessage = data.message || 'GitHub登录失败，请重试';
					
					uni.showModal({
						title: 'GitHub 登录失败',
						content: errorMessage,
						showCancel: false,
						confirmText: '知道了',
						success: () => {
							uni.reLaunch({ url: '/pages/login/login' });
						}
					});
				}
				
			} catch (e) {
				console.error('❌ [H5回调] 解析回调数据失败:', e);
				uni.showToast({ 
					title: '数据解析失败', 
					icon: 'none' 
				});
				setTimeout(() => {
					uni.reLaunch({ url: '/pages/login/login' });
				}, 1500);
			}
		}
	}
};
</script>

<style scoped>
.callback-container {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 100vh;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-box {
	text-align: center;
	padding: 60rpx;
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20rpx;
	box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.1);
}

.spinner {
	width: 80rpx;
	height: 80rpx;
	margin: 0 auto 40rpx;
	border: 6rpx solid rgba(102, 126, 234, 0.2);
	border-top-color: #667eea;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

.loading-text {
	display: block;
	font-size: 32rpx;
	color: #333;
	font-weight: 500;
}
</style>
