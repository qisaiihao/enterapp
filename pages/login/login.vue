<template>
    <view>
        <!-- pages/login/login.wxml -->
        <view class="container">
            <view class="title">欢迎来到回车键</view>
            <view class="subtitle">为了更好的体验，请设置你的头像和昵称</view>

            <view class="avatar-wrapper">
                <!-- 点击按钮选择头像 -->
                <button class="avatar-button" @tap="onChooseAvatar">
                    <!-- 如果 avatarFileID 或 localAvatarTempPath 存在，就显示头像 -->
                    <image v-if="avatarFileID || localAvatarTempPath" class="avatar" :src="localAvatarTempPath || avatarFileID"></image>
                    <!-- 否则，显示一个占位符 -->
                    <view v-else class="avatar-placeholder">
                        <text class="placeholder-text">+</text>
                    </view>
                </button>
            </view>

            <view class="nickname-wrapper">
                <text>昵称</text>
                <!-- input 框专门用于输入昵称 -->
                <input class="nickname-input" type="nickname" placeholder="请输入你的昵称" @input="onNicknameInput" />
            </view>

            <button class="save-button" @tap="onSaveProfile" :disabled="!openidReady || isSaving">进入社区</button>
        </view>

        <!-- 隐藏的canvas用于头像压缩 -->
        <canvas canvas-id="avatarCompressCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 200px; height: 200px"></canvas>
    </view>
</template>

<script>
// pages/login/login.js
const app = getApp();
const { compressAvatar } = require('../../utils/avatarCompress');
export default {
    data() {
        return {
            avatarFileID: '',
            // Changed from avatarUrl to avoid confusion
            nickName: '',
            openidReady: false,
            // Flag to control the button state
            localAvatarTempPath: '',
            // Property to store local temp path
            isSaving: false // Flag to prevent duplicate save operations
        };
    },
    onLoad: function () {
        console.log('🔍 [登录页面] 页面加载，检查openid状态');
        const openid = getApp().globalData.openid;
        console.log('🔍 [登录页面] 当前openid:', openid);
        
        if (openid) {
            console.log('✅ [登录页面] openid已存在，设置openidReady为true');
            this.setData({
                openidReady: true
            });
        } else {
            console.log('⏳ [登录页面] openid不存在，等待登录完成');
            // 设置一个定时器检查openid
            const checkOpenid = () => {
                const currentOpenid = getApp().globalData.openid;
                if (currentOpenid) {
                    console.log('✅ [登录页面] 检测到openid，设置openidReady为true');
                    this.setData({
                        openidReady: true
                    });
                } else {
                    // 继续等待
                    setTimeout(checkOpenid, 500);
                }
            };
            setTimeout(checkOpenid, 500);
        }
    },
    
    // 监控头像相关数据的变化
    watch: {
        localAvatarTempPath: function(newVal, oldVal) {
            console.log('🔍 [监控] localAvatarTempPath变化:', oldVal, '->', newVal);
        },
        avatarFileID: function(newVal, oldVal) {
            console.log('🔍 [监控] avatarFileID变化:', oldVal, '->', newVal);
        }
    },
    methods: {
        onChooseAvatar() {
            console.log('点击选择头像');
            
            // 使用uni.chooseImage选择图片
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    console.log('🔍 [选择头像] 完整返回数据:', res);
                    
                    // ✅ 关键修改：使用 res.tempFiles[0] 而不是 res.tempFilePaths[0]
                    const file = res.tempFiles[0];
                    const originalPath = res.tempFilePaths[0]; // 用于显示预览
                    
                    console.log('🔍 [选择头像] File对象:', file);
                    console.log('🔍 [选择头像] 预览路径:', originalPath);
                    console.log('🔍 [选择头像] File对象类型:', typeof file);
                    console.log('🔍 [选择头像] File对象构造函数:', file ? file.constructor.name : 'undefined');

                    if (file) {
                        // 显示预览
                        this.setData({
                            localAvatarTempPath: originalPath,
                            avatarFileID: ''
                        });

                        uni.showToast({
                            title: '图片选择成功',
                            icon: 'success',
                            duration: 1500
                        });
                        
                        // 延迟一下再上传，确保UI更新完成
                        setTimeout(() => {
                            this.uploadAvatar(file);
                        }, 100);
                    } else {
                        console.error('❌ [选择头像] File对象为空');
                        uni.showToast({
                            title: '文件选择失败',
                            icon: 'none'
                        });
                    }
                },
                fail: (err) => {
                    console.error('❌ [选择头像] 失败:', err);
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },

        onNicknameInput(e) {
            this.setData({
                nickName: e.detail.value
            });
        },

        uploadAvatar: function (fileObject) {
            if (!fileObject) {
                uni.showToast({
                    title: '没有选择文件',
                    icon: 'none'
                });
                return;
            }

            console.log('🔍 [上传] 准备上传File对象:', fileObject);

            // 获取openid
            const openid = getApp().globalData.openid;
            if (!openid) {
                uni.showToast({
                    title: '用户信息未准备好',
                    icon: 'none'
                });
                return;
            }
            
            // 直接上传，不进行额外的认证检查（避免认证冲突）
            console.log('🔍 [上传] 直接开始上传，避免认证冲突');
            this.performUpload(fileObject, openid);
        },

        // 通过云函数上传文件
        performUpload: function(fileObject, openid) {
            uni.showLoading({
                title: '上传头像中...',
                mask: true
            });
            
            const cloudPath = `avatars/${openid}_${Date.now()}.jpg`;
            console.log('🔍 [上传] 云存储路径:', cloudPath);
            console.log('🔍 [上传] 文件对象类型:', typeof fileObject);
            console.log('🔍 [上传] 文件对象详情:', fileObject);
            
            // 使用云函数处理文件上传，避免直接使用CloudBase SDK
            console.log('🔍 [上传] 通过云函数上传文件...');
            
            // 将文件转换为base64，通过云函数上传
            // 使用兼容的文件读取方式
            const filePath = fileObject.path || fileObject.tempFilePath;
            console.log('🔍 [上传] 文件路径:', filePath);
            
            // 检查环境并使用相应的文件读取方式
            if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
                // H5环境使用FileReader
                console.log('🔍 [上传] 使用FileReader读取文件');
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    this.uploadFileToCloud(base64, cloudPath, openid);
                };
                reader.onerror = () => {
                    console.error('❌ [上传] FileReader读取失败');
                    this.handleUploadFailure('文件读取失败');
                };
                reader.readAsDataURL(fileObject);
            } else {
                // App环境使用uni-app API
                console.log('🔍 [上传] 使用uni-app API读取文件');
                try {
                    const fs = uni.getFileSystemManager();
                    if (fs && fs.readFile) {
                        fs.readFile({
                            filePath: filePath,
                            encoding: 'base64',
                            success: (readRes) => {
                                const base64 = readRes.data;
                                this.uploadFileToCloud(base64, cloudPath, openid);
                            },
                            fail: (readErr) => {
                                console.error('❌ [文件读取] 失败：', readErr);
                                this.handleUploadFailure(`文件读取失败: ${readErr.errMsg || '未知错误'}`);
                            }
                        });
                    } else {
                        // 如果getFileSystemManager不可用，直接上传文件路径
                        console.log('🔍 [上传] getFileSystemManager不可用，直接上传文件路径');
                        this.uploadFileToCloud(null, cloudPath, openid, filePath);
                    }
                } catch (error) {
                    console.error('❌ [上传] 文件系统API调用失败:', error);
                    this.handleUploadFailure('文件系统API不可用');
                }
            }
        },

        // 提取上传到云端的逻辑
        uploadFileToCloud: function(base64, cloudPath, openid, filePath = null) {
            const uploadData = {
                cloudPath: cloudPath,
                openid: openid
            };
            
            if (base64) {
                uploadData.fileData = base64;
            } else if (filePath) {
                uploadData.filePath = filePath;
            }
            
            this.$tcb.callFunction({
                name: 'uploadAvatar',
                data: uploadData
            }).then((res) => {
                console.log('✅ [上传文件] 成功：', res);
                if (res.result && res.result.fileID) {
                    const fileID = res.result.fileID;
                    console.log('🔍 [上传] 获取到fileID:', fileID);
                    
                    // 使用CloudBase SDK获取临时URL用于显示
                    console.log('🔍 [上传] 获取临时URL用于显示...');
                    this.$tcb.getTempFileURL({
                        fileList: [fileID]
                    }).then((tempRes) => {
                        console.log('🔍 [上传] 临时URL获取结果:', tempRes);
                        const tempUrl = tempRes.fileList[0].tempFileURL;
                        console.log('🔍 [上传] 临时URL:', tempUrl);
                        
                        this.setData({
                            avatarFileID: fileID,
                            localAvatarTempPath: tempUrl // 使用临时URL显示图片
                        });
                        
                        console.log('🔍 [上传] 设置后的avatarFileID:', this.avatarFileID);
                        console.log('🔍 [上传] 设置后的localAvatarTempPath:', this.localAvatarTempPath);
                    }).catch((tempErr) => {
                        console.error('❌ [上传] 获取临时URL失败:', tempErr);
                        // 如果获取临时URL失败，使用原始fileID
                        this.setData({
                            avatarFileID: fileID,
                            localAvatarTempPath: fileID
                        });
                    });

                    uni.hideLoading();
                    uni.showToast({
                        title: '头像上传成功',
                        icon: 'success',
                        duration: 1000
                    });
                } else {
                    throw new Error('云函数返回格式错误');
                }
            }).catch((e) => {
                console.error('❌ [上传文件] 失败：', e);
                uni.hideLoading();
                uni.showToast({
                    title: `上传失败: ${e.message || '未知错误'}`,
                    icon: 'none',
                    duration: 3000
                });
                this.setData({
                    avatarFileID: ''
                });
            });
        },

        // 处理上传失败
        handleUploadFailure: function(message) {
            uni.hideLoading();
            uni.showToast({
                title: `上传失败: ${message}`,
                icon: 'none',
                duration: 3000
            });
            this.setData({
                avatarFileID: ''
            });
        },


        onSaveProfile() {
            console.log('🔍 [保存] 点击进入社区按钮');
            console.log('🔍 [保存] isSaving:', this.isSaving);
            console.log('🔍 [保存] openidReady:', this.openidReady);
            console.log('🔍 [保存] avatarFileID:', this.avatarFileID);
            console.log('🔍 [保存] nickName:', this.nickName);
            
            // Prevent duplicate submissions
            if (this.isSaving) {
                console.log('❌ [保存] 正在保存中，忽略重复点击');
                return;
            }
            if (!this.openidReady) {
                console.log('❌ [保存] openid未准备好');
                uni.showToast({
                    title: '正在获取用户信息...',
                    icon: 'none'
                });
                return;
            }

            // 暂时跳过头像检查，允许没有头像的用户进入
            console.log('🔍 [保存] 跳过头像检查，允许用户进入社区');
            // if (!this.avatarFileID || !this.avatarFileID.startsWith('cloud://')) {
            //     uni.showToast({
            //         title: '请等待头像上传完成',
            //         icon: 'none'
            //     });
            //     return;
            // }
            if (!this.nickName) {
                uni.showToast({
                    title: '请输入昵称',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                isSaving: true
            });
            uni.showLoading({
                title: '正在保存...'
            });

            // Call the cloud function to update user info
            const openid = getApp().globalData.openid;
            const updateData = {
                nickName: this.nickName,
                openid: openid // 传递openid给云函数
            };
            
            // 如果有头像，添加头像URL
            if (this.avatarFileID && this.avatarFileID.startsWith('cloud://')) {
                updateData.avatarUrl = this.avatarFileID;
                console.log('🔍 [保存] 包含头像URL:', this.avatarFileID);
            } else {
                console.log('🔍 [保存] 没有头像，使用默认头像');
            }
            
            console.log('🔍 [保存] 更新用户数据:', updateData);
            console.log('🔍 [保存] 传递的openid:', openid);
            
            this.$tcb.callFunction({
                name: 'updateUser',
                data: updateData
            }).then((res) => {
                console.log('🔍 [保存] updateUser云函数返回结果:', res);
                console.log('🔍 [保存] res.result:', res.result);
                console.log('🔍 [保存] res.result.success:', res.result ? res.result.success : 'undefined');
                
                if (res.result && res.result.success) {
                    console.log('✅ [保存] 用户数据保存成功');
                    uni.showToast({
                        title: '保存成功'
                    });
                    // Update globalData
                    const openid = getApp().globalData.openid;
                    const userInfo = {
                        nickName: this.nickName,
                        avatarUrl: this.avatarFileID || '', // 如果没有头像，使用空字符串
                        _openid: openid
                    };
                    this.userInfo = userInfo;
                    // Save userInfo to local storage
                    uni.setStorageSync('userInfo', userInfo);
                    // Redirect to the home page (poem page)
                    uni.switchTab({
                        url: '/pages/poem/poem'
                    });
                } else {
                    console.error('❌ [保存] 云函数返回失败:', res.result);
                    uni.showToast({
                        title: '保存失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                console.error('❌ [保存] 云函数调用失败:', err);
                uni.showToast({
                    title: '调用失败',
                    icon: 'none'
                });
                console.error('[云函数] [updateUser] 调用失败', err);
            }).finally(() => {
                uni.hideLoading(); // Always hide loading
                this.setData({
                    isSaving: false
                }); // Always reset the saving flag
            });
        }
    }
};
</script>
<style>
/* pages/login/login.wxss */
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 40rpx;
    height: 100vh; /* Make container take full viewport height */
    overflow-y: auto; /* Enable vertical scrolling if content overflows */
}

.title {
    font-size: 48rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
}

.subtitle {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 80rpx;
}

.avatar-wrapper {
    margin-bottom: 60rpx;
    width: 100%; /* Ensure it takes full width */
}

.avatar-button {
    padding: 0; /* 移除内边距 */
    border: none; /* 移除边框 */
    background-color: transparent; /* 透明背景 */
    line-height: 0; /* 移除行高 */
    width: 100%; /* Ensure it takes full width */
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 将圆形样式直接应用于图片 */
.avatar {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
}

.nickname-wrapper {
    width: 100%;
    margin-bottom: 200rpx; /* Increased margin to give space for system UI */
    border-bottom: 1px solid #f0f0f0;
    padding: 20rpx 0;
    display: flex;
    align-items: center;
}

.nickname-wrapper text {
    font-size: 32rpx;
    margin-right: 30rpx;
}

.nickname-input {
    flex: 1;
    font-size: 32rpx;
}

.save-button {
    width: 100%;
    background-color: #9ed7ee;
    color: white;
    font-size: 32rpx;
}

.avatar-placeholder {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #e0e0e0;
}

.placeholder-text {
    font-size: 80rpx;
    color: #999;
    font-weight: 100;
}
</style>
