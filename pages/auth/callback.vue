<template>
	<view class="callback-container">
		<view class="loading-box">
			<view class="spinner"></view>
			<text class="loading-text">{{ loadingText }}</text>
		</view>
	</view>
</template>

<script>
import { applyAuthenticatedUserSession } from '@/utils/appBackground.js';

export default {
	data() {
		return {
			loadingText: 'Processing sign-in...'
		};
	},

	onLoad(options) {
		if (typeof window !== 'undefined' && window.location) {
			console.log('[auth callback] url:', window.location.href);
		}
		this.handleCallback(options);
	},

	methods: {
		async handleCallback(options) {
			const type = options.type;
			const encodedData = options.data;

			if (!type || !encodedData) {
				uni.showToast({
					title: 'Invalid callback',
					icon: 'none'
				});
				setTimeout(() => {
					uni.reLaunch({ url: '/pages/login/login' });
				}, 1500);
				return;
			}

			try {
				const data = JSON.parse(decodeURIComponent(encodedData));
				console.log('[auth callback] payload:', data);

				if (type === 'register') {
					this.loadingText = 'Redirecting to sign up...';
					uni.setStorageSync('github_temp_data', data);
					setTimeout(() => {
						uni.reLaunch({
							url: `/pages/register/register?fromGithub=true&githubData=${encodeURIComponent(JSON.stringify(data))}`
						});
					}, 500);
					return;
				}

				if (type === 'login') {
					this.loadingText = 'Sign-in complete, redirecting...';

					const userInfo = data.user || null;
					if (!userInfo) {
						throw new Error('Missing user info');
					}

					uni.setStorageSync('github_access_token', data.accessToken || '');
					await applyAuthenticatedUserSession(userInfo, {
						openid: userInfo._openid || userInfo.openid || ''
					});

					uni.showToast({
						title: 'Signed in',
						icon: 'success'
					});

					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/poem-square/poem-square'
						});
					}, 1000);
					return;
				}

				if (type === 'error') {
					const errorMessage = data.message || 'GitHub sign-in failed';
					uni.showModal({
						title: 'GitHub Sign-In Failed',
						content: errorMessage,
						showCancel: false,
						confirmText: 'OK',
						success: () => {
							uni.reLaunch({ url: '/pages/login/login' });
						}
					});
				}
			} catch (error) {
				console.error('[auth callback] failed:', error);
				uni.showToast({
					title: 'Invalid payload',
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
	to {
		transform: rotate(360deg);
	}
}

.loading-text {
	display: block;
	font-size: 32rpx;
	color: #333;
	font-weight: 500;
}
</style>
