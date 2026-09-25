<template>
  <view class="collage-upload" :style="mpNavStyle">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
    </view>

    <!-- 内容区域 -->
    <view class="container">
      <!-- 上传区域 -->
      <view class="upload-section">
        <view class="upload-title">上传拼贴诗图片</view>
        
        <!-- 图片预览区域 -->
        <view class="image-preview-container" v-if="selectedImage">
          <image 
            class="preview-image" 
            :src="selectedImage" 
            mode="aspectFit"
            @tap="previewImage"
          />
          <!-- 删除按钮 - 右下角 -->
          <view class="delete-btn" @tap="removeImage">
            <image class="delete-icon" src="/static/images/delete.png" mode="aspectFit"></image>
          </view>
        </view>
        
        <!-- 上传按钮区域 -->
        <view class="upload-area" v-else @tap="chooseImage">
          <view class="upload-icon">📷</view>
          <text class="upload-text">点击选择图片</text>
          <text class="upload-hint">支持 JPG、PNG 格式，建议小于5MB</text>
        </view>
        
        <!-- 上传按钮 - 右下角 -->
        <view 
          class="submit-btn" 
          :class="{ 'disabled': !selectedImage || isUploading }"
          @tap="uploadImage"
          v-if="selectedImage"
        >
          <image class="submit-icon" src="/static/images/enter_key.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>
  </view>
    <app-overlay-host />
</template>

<script>
import { cloudCall } from '../../utils/cloudCall.js';
import { getCloudFunctionMethod, getCurrentPlatform } from '../../utils/platformDetector.js';
import { requestAndroidStoragePermission } from '../../utils/permissions.js';
import { readFileAsBase64 as readImageBase64 } from '../../utils/fileReader.js';
import { createCollageLogger } from '@/utils/collage/debug.js';
import { getCollageNavStyle } from '@/utils/collage/nav.js';

const log = createCollageLogger('upload');
const platformDetector = {
  getCurrentPlatform,
  getCloudFunctionMethod
};

export default {
  data() {
    return {
      selectedImage: '', // 选中的图片路径
      isUploading: false, // 是否正在上传
      imageInfo: null, // 图片信息对象
      mpNavStyle: null
    }
  },
  onLoad() {
    log.info('进入拼贴诗上传页');
    this.mpNavStyle = getCollageNavStyle();
    const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (channel && channel.on) channel.on('collageExport', ({ path }) => {
      if (!path) {
        log.warn('发布交接未收到图片路径');
        return;
      }
      log.info('收到画布导出的作品图', { path });
      this.selectedImage = path;
      this.imageInfo = { originalPath: path, compressedPath: path, previewUrl: path, extension: 'png' };
    });
  },

  methods: {
    goBack() {
      uni.navigateBack()
    },
    
    // 选择图片
    chooseImage() {
      if (platformDetector.getCurrentPlatform() === 'app') {
        this.chooseImageForApp();
        return;
      }
      uni.chooseImage({
        count: 1,
        // 统一使用压缩模式
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          uni.showLoading({
            title: '处理中...'
          });

          // 使用包含size的 res.tempFiles
          const file = res.tempFiles[0];
          const tempFilePath = file.path;
          const sizeInBytes = file.size;
          log.info('选择图片', { path: tempFilePath, kb: (sizeInBytes / 1024).toFixed(2) });
          
          // 检查文件大小限制（5MB）
          if (sizeInBytes > 5 * 1024 * 1024) {
            log.warn('图片超过 5MB 限制', { path: tempFilePath, mb: (sizeInBytes / 1024 / 1024).toFixed(2) });
            uni.hideLoading();
            uni.showModal({
              title: '错误',
              content: `图片文件过大 (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB)，请选择小于5MB的图片`,
              showCancel: false,
              confirmText: '确定'
            });
            return;
          }
          
          const needCompression = sizeInBytes > 200000; // 200KB阈值
          this.imageInfo = {
            originalPath: tempFilePath,
            imageSize: sizeInBytes,
            needCompression: needCompression,
            previewUrl: tempFilePath,
            compressedPath: tempFilePath,
            originalUrl: '',
            compressedUrl: ''
          };
          
          if (needCompression) {
            // 如果需要压缩，调用压缩函数
            this.compressImage(this.imageInfo)
              .then(() => {
                uni.hideLoading();
                this.selectedImage = this.imageInfo.previewUrl;
              })
              .catch((err) => {
                uni.hideLoading();
                log.warn('图片压缩失败，使用原图', err);
                // 压缩失败，使用原图
                this.imageInfo.compressedPath = this.imageInfo.originalPath;
                this.imageInfo.previewUrl = this.imageInfo.originalPath;
                this.selectedImage = this.imageInfo.previewUrl;
              });
          } else {
            // 不需要压缩，直接使用原图
            uni.hideLoading();
            this.selectedImage = this.imageInfo.previewUrl;
          }
        },
        fail: (err) => {
          log.warn('选择图片失败', err)
          // 如果是用户取消，不显示错误提示
          if (err.errMsg && err.errMsg.includes('cancel')) {
            return
          }
          uni.showToast({
            title: '选择图片失败',
            icon: 'none'
          })
        }
      })
    },
    
    // 压缩图片
    chooseImageForApp() {
      requestAndroidStoragePermission().then((granted) => {
        if (!granted) {
          return;
        }

        const chooseApi = typeof uni.chooseMedia === 'function' ? 'chooseMedia' : 'chooseImage';
        const chooseOptions = {
          count: 1,
          sourceType: ['album', 'camera'],
          success: (res) => {
            this.handleSelectedImageResult(res);
          },
          fail: (err) => {
            log.warn('App 选择图片失败', err);
            if (err && err.errMsg && err.errMsg.includes('cancel')) {
              return;
            }
            uni.showToast({
              title: err && err.errMsg && err.errMsg.includes('\u6587\u4ef6\u7ba1\u7406\u5668') ? '\u9700\u8981\u76f8\u518c\u6743\u9650' : '\u9009\u62e9\u56fe\u7247\u5931\u8d25',
              icon: 'none'
            });
          }
        };

        if (chooseApi === 'chooseMedia') {
          uni.chooseMedia({
            ...chooseOptions,
            mediaType: ['image']
          });
          return;
        }

        uni.chooseImage({
          ...chooseOptions,
          sizeType: ['compressed']
        });
      });
    },

    handleSelectedImageResult(res) {
      this.normalizeSelectedImageFile(res).then((file) => {
        if (!file || !file.path) {
          throw new Error('\u672a\u83b7\u53d6\u5230\u6709\u6548\u7684\u56fe\u7247\u6587\u4ef6');
        }

        uni.showLoading({
          title: '\u5904\u7406\u4e2d...'
        });

        const tempFilePath = file.path;
        const sizeInBytes = file.size || 0;
        log.info('App 选择图片', { path: tempFilePath, kb: sizeInBytes ? (sizeInBytes / 1024).toFixed(2) : 0 });

        if (sizeInBytes > 5 * 1024 * 1024) {
          log.warn('图片超过 5MB 限制', { path: tempFilePath, mb: (sizeInBytes / 1024 / 1024).toFixed(2) });
          uni.hideLoading();
          uni.showModal({
            title: '\u63d0\u793a',
            content: `\u56fe\u7247\u6587\u4ef6\u8fc7\u5927 (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB)\uff0c\u8bf7\u9009\u62e9\u5c0f\u4e8e5MB\u7684\u56fe\u7247`,
            showCancel: false,
            confirmText: '\u786e\u5b9a'
          });
          return;
        }

        const needCompression = sizeInBytes > 200000;
        this.imageInfo = {
          originalPath: tempFilePath,
          imageSize: sizeInBytes,
          needCompression: needCompression,
          previewUrl: tempFilePath,
          compressedPath: tempFilePath,
          originalUrl: '',
          compressedUrl: ''
        };

        if (needCompression) {
          this.compressImage(this.imageInfo)
            .then(() => {
              uni.hideLoading();
              this.selectedImage = this.imageInfo.previewUrl;
            })
            .catch((err) => {
              uni.hideLoading();
              log.warn('图片压缩失败，使用原图', err);
              this.imageInfo.compressedPath = this.imageInfo.originalPath;
              this.imageInfo.previewUrl = this.imageInfo.originalPath;
              this.selectedImage = this.imageInfo.previewUrl;
            });
          return;
        }

        uni.hideLoading();
        this.selectedImage = this.imageInfo.previewUrl;
      }).catch((err) => {
        log.error('App 图片预处理失败', err);
        uni.hideLoading();
        uni.showToast({
          title: '\u9009\u62e9\u56fe\u7247\u5931\u8d25',
          icon: 'none'
        });
      });
    },

    normalizeSelectedImageFile(res) {
      return new Promise((resolve) => {
        const tempFiles = Array.isArray(res && res.tempFiles) ? res.tempFiles : [];
        const firstFile = tempFiles[0] || {};
        const tempFilePaths = Array.isArray(res && res.tempFilePaths) ? res.tempFilePaths : [];
        const filePath = firstFile.path || firstFile.tempFilePath || firstFile.filePath || tempFilePaths[0] || '';

        if (!filePath) {
          resolve(null);
          return;
        }

        if (typeof firstFile.size === 'number' && firstFile.size > 0) {
          resolve({
            path: filePath,
            size: firstFile.size
          });
          return;
        }

        uni.getFileInfo({
          filePath,
          success: (fileInfo) => {
            resolve({
              path: filePath,
              size: fileInfo.size || 0
            });
          },
          fail: (err) => {
            log.warn('读取图片大小失败', err);
            resolve({
              path: filePath,
              size: 0
            });
          }
        });
      });
    },

    compressImage(imageInfo) {
      return new Promise((resolve) => {
        // 检查运行环境
        const platform = platformDetector.getCurrentPlatform();
        
        if (platform === 'h5') {
          // H5环境使用Canvas压缩
          log.debug('H5 环境使用 Canvas 压缩图片');
          this.compressImageWithCanvas(imageInfo).then(resolve).catch((error) => {
            // Canvas压缩失败，使用原图
            log.warn('Canvas 压缩失败，使用原图', error);
            imageInfo.compressedPath = imageInfo.originalPath;
            imageInfo.previewUrl = imageInfo.originalPath;
            resolve(imageInfo);
          });
        } else {
          // App环境使用uni.compressImage
          log.debug('App/小程序环境使用 uni.compressImage 压缩图片');
          uni.compressImage({
            src: imageInfo.originalPath,
            quality: 80,
            success: (res) => {
              log.debug('压缩成功', { path: res.tempFilePath });
              imageInfo.compressedPath = res.tempFilePath;
              imageInfo.previewUrl = res.tempFilePath;
              resolve(imageInfo);
            },
            fail: (err) => {
              log.warn('压缩失败，使用原图', err);
              // 压缩失败，使用原图
              imageInfo.compressedPath = imageInfo.originalPath;
              imageInfo.previewUrl = imageInfo.originalPath;
              resolve(imageInfo);
            }
          });
        }
      });
    },
    
    // H5环境Canvas压缩
    compressImageWithCanvas(imageInfo) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 计算压缩后的尺寸
          let { width, height } = img;
          const maxSize = 1920; // 最大尺寸
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // 绘制压缩后的图片
          ctx.drawImage(img, 0, 0, width, height);
          
          // 转换为blob
          canvas.toBlob((blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const compressedDataUrl = e.target.result;
                imageInfo.compressedPath = compressedDataUrl;
                imageInfo.previewUrl = compressedDataUrl;
                resolve(imageInfo);
              };
              reader.readAsDataURL(blob);
            } else {
              reject(new Error('Canvas压缩失败'));
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = imageInfo.originalPath;
      });
    },
    
    // 预览图片
    previewImage() {
      uni.previewImage({
        urls: [this.selectedImage],
        current: this.selectedImage
      })
    },
    
    // 删除图片
    removeImage() {
      this.selectedImage = ''
      this.imageInfo = null
    },
    
    // 上传图片
    async uploadImage() {
      if (!this.selectedImage || !this.imageInfo) {
        uni.showToast({
          title: '请先选择图片',
          icon: 'none'
        })
        return
      }
      
      if (this.isUploading) {
        return
      }
      
      this.isUploading = true
      log.info('开始发布拼贴诗', { path: this.imageInfo.compressedPath, extension: this.imageInfo.extension || 'jpg' })
      
      try {
        uni.showLoading({
          title: '上传中...'
        })
        
        // 读取文件内容为base64
        const fileContent = await readImageBase64(this.imageInfo.compressedPath)
        
        if (!fileContent) {
          throw new Error('读取文件失败')
        }
        
        log.debug('文件读取成功', { base64Length: fileContent.length })
        
        // 调用uploadCollagePoetry云函数，完成上传和创建帖子
        const cloudPath = `collage-poetry/${Date.now()}.${this.imageInfo.extension || 'jpg'}`
        
        const collageResult = await cloudCall('uploadCollagePoetry', {
          cloudPath: cloudPath,
          fileContent: fileContent
        }, { pageTag: 'collage-upload', context: this, requireAuth: true })
        
        // 检查返回结果
        if (collageResult && collageResult.result && collageResult.result.success) {
          log.info('发布成功', { cloudPath, result: collageResult.result })
          uni.hideLoading()
          uni.showToast({
            title: '发布成功',
            icon: 'success'
          })
          
          // 清空选择的图片
          this.selectedImage = ''
          this.imageInfo = null
          
          // 延迟返回上一页
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          const errorMsg = collageResult?.result?.message || '发布失败'
          log.error('发布失败', { cloudPath, message: errorMsg, result: collageResult })
          throw new Error(errorMsg)
        }
      } catch (error) {
        uni.hideLoading()
        log.error('上传失败', error)
        uni.showToast({
          title: error.message || '上传失败',
          icon: 'none'
        })
      } finally {
        this.isUploading = false
      }
    },
    
    // 读取文件为base64
    readFileAsBase64(filePath) {
      return new Promise((resolve, reject) => {
        // 检查环境并使用相应的文件读取方式
        if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
          // H5环境：使用fetch获取blob，然后转换为base64
          fetch(filePath)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              return response.blob()
            })
            .then(blob => {
              const reader = new FileReader()
              reader.onload = () => {
                const result = reader.result
                if (!result || typeof result !== 'string') {
                  reject(new Error('文件读取失败'))
                  return
                }
                const base64 = result.split(',')[1]
                resolve(base64)
              }
              reader.onerror = () => reject(new Error('文件读取失败'))
              reader.readAsDataURL(blob)
            })
            .catch(reject)
        } else {
          // App环境使用uni-app API
          try {
            const fs = uni.getFileSystemManager()
            if (fs && fs.readFile) {
              fs.readFile({
                filePath: filePath,
                encoding: 'base64',
                success: (res) => resolve(res.data),
                fail: (err) => reject(new Error(`文件读取失败: ${err.errMsg || '未知错误'}`))
              })
            } else {
              reject(new Error('文件系统不可用'))
            }
          } catch (err) {
            reject(new Error('文件读取失败: ' + err.message))
          }
        }
      })
    },
    
    // 兼容性文件上传方法
    uploadFile(imageInfo) {
      return new Promise((resolve, reject) => {
        const method = platformDetector.getCloudFunctionMethod();
        
        if (method === 'tcb') {
          // H5和App环境：使用云函数上传
          this.uploadFileViaCloudFunction(imageInfo).then(resolve).catch(reject);
        } else if (method === 'wx-cloud') {
          // 小程序环境使用微信云开发
          if (wx.cloud && wx.cloud.uploadFile) {
            const cloudPath = `collage-poetry/${Date.now()}.jpg`;
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: imageInfo.compressedPath,
              success: (res) => {
                resolve({
                  success: true,
                  fileID: res.fileID,
                  cloudPath: cloudPath
                });
              },
              fail: (err) => {
                reject(new Error('微信云开发上传失败: ' + err.errMsg));
              }
            });
          } else {
            reject(new Error('微信云开发不可用'));
          }
        } else {
          reject(new Error(`不支持的云函数调用方式: ${method}`));
        }
      });
    },
    
    // 通过云函数上传文件（解决H5环境multipart/form-data问题）
    uploadFileViaCloudFunction(imageInfo, retryCount = 0) {
      return new Promise((resolve, reject) => {
        const cloudPath = `collage-poetry/${Date.now()}.jpg`;
        
        // 检查环境并使用相应的文件读取方式
        if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
          // H5环境：使用fetch获取blob，然后转换为base64
          fetch(imageInfo.compressedPath)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.blob();
            })
            .then(blob => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result;
                if (!result || typeof result !== 'string') {
                  reject(new Error('文件读取失败'));
                  return;
                }
                const base64 = result.split(',')[1];
                log.debug('文件转换为 base64 完成', { base64Length: base64.length });
                
                cloudCall('upload', {
                  cloudPath: cloudPath,
                  fileContent: base64
                }, { pageTag: 'collage-upload', context: this, requireAuth: true }).then((uploadRes) => {
                  log.debug('上传云函数返回', uploadRes);
                  if (uploadRes && uploadRes.result && uploadRes.result.success) {
                    resolve({
                      success: true,
                      fileID: uploadRes.result.fileID,
                      cloudPath: uploadRes.result.cloudPath
                    });
                  } else {
                    reject(new Error('上传云函数返回格式错误'));
                  }
                }).catch((err) => {
                  // 如果是网络错误且重试次数小于2，则重试
                  if (retryCount < 2 && (err.errMsg === 'request:fail' || err.message?.includes('fail'))) {
                    log.warn(`上传失败，准备重试 (${retryCount + 1}/2)`, err);
                    setTimeout(() => {
                      this.uploadFileViaCloudFunction(imageInfo, retryCount + 1)
                        .then(resolve).catch(reject);
                    }, 1000 * (retryCount + 1));
                  } else {
                    reject(err);
                  }
                });
              };
              reader.onerror = () => {
                reject(new Error('文件读取失败'));
              };
              reader.readAsDataURL(blob);
            })
            .catch(err => {
              reject(new Error('获取文件失败: ' + err.message));
            });
        } else {
          // App环境使用uni-app API
          log.debug('App/小程序环境使用文件系统读取文件');
          try {
            const fs = uni.getFileSystemManager();
            if (fs && fs.readFile) {
              fs.readFile({
                filePath: imageInfo.compressedPath,
                encoding: 'base64',
                success: (readRes) => {
                  const base64 = readRes.data;
                  log.debug('文件读取完成', { base64Length: base64.length });
                  cloudCall('upload', {
                    cloudPath: cloudPath,
                    fileContent: base64
                  }, { pageTag: 'collage-upload', context: this, requireAuth: true }).then((uploadRes) => {
                    log.debug('上传云函数返回', uploadRes);
                    if (uploadRes && uploadRes.result && uploadRes.result.success) {
                      resolve({
                        success: true,
                        fileID: uploadRes.result.fileID,
                        cloudPath: uploadRes.result.cloudPath
                      });
                    } else {
                      reject(new Error('上传云函数返回格式错误'));
                    }
                  }).catch(reject);
                },
                fail: (readErr) => {
                  log.error('文件读取失败', readErr);
                  reject(new Error(`文件读取失败: ${readErr.errMsg || '未知错误'}`));
                }
              });
            } else {
              reject(new Error('文件系统不可用'));
            }
          } catch (err) {
            reject(new Error('文件读取失败: ' + err.message));
          }
        }
      });
    }
  }
}
</script>

<style scoped>
.collage-upload {
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  position: relative;
}

/* 自定义返回按钮 */
.custom-back-btn {
  position: absolute;
  top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px)));
  left: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.2s ease;
}

/* #ifdef MP-WEIXIN */
/* 小程序端：与胶囊按钮同一行，紧凑靠左，避开刘海屏 */
.custom-back-btn {
  top: var(--collage-nav-top, calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px))));
  left: 24rpx;
  width: 80rpx;
  height: 80rpx;
}
/* #endif */

.custom-back-btn:active {
  transform: scale(0.95);
}

.custom-back-btn .back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  object-fit: contain;
}

.container {
  background-color: #ffffff;
  min-height: 100vh;
  padding: 140rpx 20rpx 40rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.upload-section {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 60rpx;
  text-align: center;
}

/* 图片预览区域 */
.image-preview-container {
  width: 100%;
  margin-bottom: 40rpx;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
  /* 使用固定高度，但比原来大很多 */
  height: 600rpx;
  background-color: #f5f5f5;
  position: relative;
}

.preview-image {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  /* 确保图片完整显示 */
  object-fit: contain;
}

.image-actions {
  display: flex;
  justify-content: center;
  padding: 20rpx;
  background-color: #ffffff;
}

.action-btn {
  padding: 16rpx 32rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 删除按钮 - 右下角 */
.delete-btn {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.delete-icon {
  width: 80rpx !important;
  height: 80rpx !important;
  max-width: none !important;
  max-height: none !important;
}

/* 上传区域 */
.upload-area {
  width: 100%;
  height: 400rpx;
  border: 2rpx dashed #cccccc;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
  margin-bottom: 40rpx;
  transition: all 0.2s ease;
}

.upload-area:active {
  border-color: #9ed7ee;
  background-color: #f0f9ff;
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.upload-text {
  font-size: 32rpx;
  color: #333333;
  margin-bottom: 10rpx;
}

.upload-hint {
  font-size: 24rpx;
  color: #999999;
}

/* 上传按钮 - 右下角 */
.submit-btn {
  position: fixed;
  bottom: 40rpx;
  right: 40rpx;
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 100;
}

.submit-icon {
  width: 100rpx !important;
  height: 100rpx !important;
  max-width: none !important;
  max-height: none !important;
}

.submit-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 10rpx rgba(158, 215, 238, 0.3);
}

.submit-btn.disabled {
  background: #cccccc;
  box-shadow: none;
  cursor: not-allowed;
}

.submit-btn.disabled:active {
  transform: none;
}
</style>
