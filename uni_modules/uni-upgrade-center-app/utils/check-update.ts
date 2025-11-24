// @ts-nocheck - 条件编译导致 TypeScript 类型检查问题，禁用此文件的类型检查
// 类型声明，用于条件编译块内的全局对象
declare const uni: any
declare const plus: any
declare const uniCloud: any

import callCheckVersion, { UniUpgradeCenterResult } from "./call-check-version"
import { platform_iOS } from './utils'
// #ifdef UNI-APP-X
// @ts-ignore - 条件编译模块
import { openSchema } from '@/uni_modules/uts-openSchema'
// #endif

// 推荐再App.vue中使用
const PACKAGE_INFO_KEY = '__package_info__'
// #ifdef APP-HARMONY
// @ts-ignore - 条件编译导致类型检查问题
export default function (component?: any) : Promise<UniUpgradeCenterResult> {
// #endif
// #ifndef APP-HARMONY
// @ts-ignore - 条件编译导致类型检查问题
export default function () : Promise<UniUpgradeCenterResult> {
// #endif
	return new Promise<UniUpgradeCenterResult>((resolve, reject) => {
		console.log('📱 [热更新] check-update: 开始检查更新...')
		callCheckVersion().then(async (uniUpgradeCenterResult) => {
			// NOTE uni-app x 3.96 解构有问题
			const code = uniUpgradeCenterResult.code
			const message = uniUpgradeCenterResult.message
			const url = uniUpgradeCenterResult.url // 安装包下载地址
			console.log('📱 [热更新] check-update: 版本检查返回 code:', code)
        // 此处逻辑仅为示例，可自行编写
        if (code > 0) {
			console.log('📱 [热更新] check-update: 检测到新版本，code:', code, '版本信息:', {
				version: uniUpgradeCenterResult.version,
				type: uniUpgradeCenterResult.type,
				platform: uniUpgradeCenterResult.platform,
				is_mandatory: uniUpgradeCenterResult.is_mandatory,
				is_silently: uniUpgradeCenterResult.is_silently
			})
          // 腾讯云获取下载链接
          if (/^cloud:\/\//.test(url)) {
              const tcbRes = await uniCloud.getTempFileURL({ fileList: [url] });
              if (typeof tcbRes.fileList[0].tempFileURL !== 'undefined') uniUpgradeCenterResult.url = tcbRes.fileList[0].tempFileURL;
          }

          /**
           * 提示升级一
           * 使用 uni.showModal
           */
          // return updateUseModal(uniUpgradeCenterResult)

          // #ifndef UNI-APP-X
          // 静默更新，只有wgt有
          if (uniUpgradeCenterResult.is_silently) {
            console.log('📱 [热更新] check-update: 检测到静默更新，开始后台下载...')
            uni.downloadFile({
              url: uniUpgradeCenterResult.url,
              success: res => {
                if (res.statusCode == 200) {
                  console.log('📱 [热更新] check-update: 静默更新下载成功，开始安装...')
                  // 下载好直接安装，下次启动生效
                  plus.runtime.install(res.tempFilePath, {
                    force: true
                  });
                  console.log('📱 [热更新] check-update: 静默更新安装完成，下次启动生效')
                  console.log('✅ 热更新成功')
                }
              }
            });
            return;
          }
          // #endif

          /**
           * 提示升级二
           * 官方适配的升级弹窗，可自行替换资源适配UI风格
           */
          // #ifndef UNI-APP-X
          // #ifdef APP-PLUS
          uni.setStorageSync(PACKAGE_INFO_KEY, uniUpgradeCenterResult)
          uni.navigateTo({
            url: `/uni_modules/uni-upgrade-center-app/pages/upgrade-popup?local_storage_key=${PACKAGE_INFO_KEY}`,
            fail: (err) => {
              console.error('更新弹框跳转失败', err)
              uni.removeStorageSync(PACKAGE_INFO_KEY)
            }
          })
          // #endif
          // #ifdef APP-HARMONY
          if (component) {
            component.show(true, uniUpgradeCenterResult)
          } else {
            reject({
              code: -1,
              message: '在 HarmonyOS Next 平台请传递组件使用'
            })
          }
          // #endif
          // #endif
          // #ifdef UNI-APP-X
          uni.setStorageSync(PACKAGE_INFO_KEY, uniUpgradeCenterResult)
          uni.openDialogPage({
            url: `/uni_modules/uni-upgrade-center-app/pages/uni-app-x/upgrade-popup?local_storage_key=${PACKAGE_INFO_KEY}`,
            disableEscBack: true,
            fail: (err) => {
              console.error('更新弹框跳转失败', err)
              uni.removeStorageSync(PACKAGE_INFO_KEY)
            }
          })
          // #endif

          return resolve(uniUpgradeCenterResult)
        } else if (code < 0) {
          // code < 0 表示错误，需要区分处理
          if (code === -101) {
            // -101 表示数据库中没有找到版本记录，可能是：
            // 1. 数据库中没有该 appid 的版本记录
            // 2. appid 不匹配
            // 3. 平台不匹配
            console.warn('⚠️ [热更新] check-update: 数据库中没有找到版本记录，code:', code, 'message:', message)
            console.warn('⚠️ [热更新] 可能的原因：1. 数据库中没有该 appid 的版本记录 2. appid 不匹配 3. 平台不匹配')
          } else if (code === -102) {
            // -102 表示参数错误
            console.error('❌ [热更新] check-update: 参数错误，code:', code, 'message:', message)
          } else if (code === -999) {
            // -999 表示云服务资源耗尽
            console.warn('⚠️ [热更新] check-update: 云服务资源已耗尽，请稍后重试或联系管理员')
          } else {
            console.error('❌ [热更新] check-update: 版本检查失败，code:', code, 'message:', message)
          }
          return reject(uniUpgradeCenterResult)
        }
        // code === 0 表示当前已是最新版本
        console.log('📱 [热更新] check-update: 当前已是最新版本，无需更新')
        return resolve(uniUpgradeCenterResult)
      }).catch((err) => {
        // 检查是否是资源耗尽错误
        const errorMsg = err?.errMsg || err?.message || String(err)
        if (errorMsg.includes('resource exhausted') || errorMsg.includes('ResourceExhausted') || err?.code === -999) {
          console.warn('⚠️ [热更新] check-update: 云服务资源已耗尽，请稍后重试')
        }
        reject(err)
      })
    });
  }

/**
 * 使用 uni.showModal 升级
 */
// @ts-ignore - 条件编译导致类型检查问题
function updateUseModal(packageInfo : UniUpgradeCenterResult) : void {
	// #ifdef APP
	// 函数实现
	const {
		title, // 标题
		contents, // 升级内容
		is_mandatory, // 是否强制更新
		url, // 安装包下载地址
		type,
		platform
	} = packageInfo;

	let isWGT = type === 'wgt'
	let isiOS = !isWGT ? platform.includes(platform_iOS) : false;

	let confirmText: string
	// #ifndef UNI-APP-X
	confirmText = isiOS ? '立即跳转更新' : '立即下载更新'
	// #endif
	// #ifdef UNI-APP-X
	confirmText = '立即下载更新'
	// #endif

    uni.showModal({
      title,
      content: contents,
      showCancel: !is_mandatory,
      confirmText,
      success: res => {
        if (res.cancel) return;

			if (isiOS) {
				// iOS 平台跳转 AppStore
				// #ifndef UNI-APP-X
				plus.runtime.openURL(url);
				// #endif
				// #ifdef UNI-APP-X
				openSchema(url)
				// #endif
				return;
			}

        uni.showToast({
          title: '后台下载中……',
          duration: 1000
        });

			// wgt 和 安卓下载更新
			uni.downloadFile({
				url,
				success: res => {
					if (res.statusCode !== 200) {
						console.error('下载安装包失败');
						return;
					}
					// 下载好直接安装，下次启动生效
          // uni-app x 项目没有 plus5+ 故使用条件编译
					// #ifndef UNI-APP-X
					plus.runtime.install(res.tempFilePath, {
						force: true
					}, () => {
						console.log('✅ 热更新成功')
						if (is_mandatory) {
							//更新完重启app
							// #ifdef APP-PLUS
							plus.runtime.restart();
							// #endif
							// #ifdef APP-HARMONY
							uni.showModal({
								title: '安装成功',
								content: '请手动重启应用',
								showCancel: false,
								success: res => {
									plus.runtime.quit();
								}
							});
							// #endif
							return;
						}
						uni.showModal({
							title: '安装成功是否重启？',
							success: res => {
								if (res.confirm) {
									//更新完重启app
									// #ifdef APP-PLUS
									plus.runtime.restart();
									// #endif
									// #ifdef APP-HARMONY
									plus.runtime.quit();
									// #endif
								}
							}
						});
					}, err => {
						uni.showModal({
							title: '更新失败',
							content: err
								.message,
							showCancel: false
						});
					});
					// #endif

          // #ifdef UNI-APP-X
          uni.installApk({
          	filePath: res.tempFilePath,
          	success: () => {
          		console.log('✅ 热更新成功')
          		uni.showModal({
          			title: '安装成功请手动重启'
          		});
          	},
          	fail: err => {
          		uni.showModal({
          			title: '更新失败',
          			content: err.errMsg,
          			showCancel: false
          		});
          	}
          });
          // #endif
				}
			});
		}
	});
	// #endif
	// 非 APP 环境下函数体为空
	return;
}
}
