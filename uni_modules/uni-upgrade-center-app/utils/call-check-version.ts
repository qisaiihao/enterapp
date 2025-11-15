// 类型声明，用于条件编译块内的全局对象
declare const uni: any
declare const plus: any
declare const uniCloud: any

export type StoreListItem = {
	enable : boolean
	id : string
	name : string
	scheme : string
	priority : number // 优先级
}

export type UniUpgradeCenterResult = {
	_id : string
	appid : string
	name : string
	title : string
	contents : string
	url : string // 安装包下载地址
	platform : Array<string> // Array<'Android' | 'iOS' | 'Harmony'>
	version : string // 版本号 1.0.0
	uni_platform : string // "android" | "ios" | 'harmony'
	stable_publish : boolean // 是否是稳定版
	is_mandatory : boolean // 是否强制更新
	is_silently : boolean | null	// 是否静默更新
	create_env : string // "upgrade-center"
	create_date : number
	message : string
	code : number

	type : string // "native_app" | "wgt"
	store_list : StoreListItem[] | null
	min_uni_version : string | null  // 升级 wgt 的最低 uni-app 版本
}

export default function () : Promise<UniUpgradeCenterResult> {
	// #ifdef APP
	return new Promise<UniUpgradeCenterResult>((resolve, reject) => {
		const systemInfo = uni.getSystemInfoSync()
		// 写死 appid，直接使用 manifest.json 中的格式（与数据库格式一致）
		const appId = '__UNI__E0A1A41'
		// 使用 plus.runtime.version 获取版本号（versionCode），而不是 systemInfo.appVersion（versionName）
		// plus.runtime.version 返回的是 manifest.json 中的 versionCode（整数）
		// systemInfo.appVersion 返回的是 versionName（字符串，如 "1.0.0"）
		const appVersion = plus.runtime.version || systemInfo.appVersion
		console.log('📱 [热更新] call-check-version: 使用固定 App ID:', appId, 'App 版本:', appVersion)
		console.log('📱 [热更新] call-check-version: plus.runtime.version:', plus.runtime.version, '(versionCode)')
		console.log('📱 [热更新] call-check-version: systemInfo.appVersion:', systemInfo.appVersion, '(versionName)')
		console.log('📱 [热更新] call-check-version: systemInfo.appId:', systemInfo.appId, '(仅供参考)')
		console.log('📱 [热更新] call-check-version: plus.runtime.appid:', plus.runtime.appid, '(仅供参考)')
		// #ifndef UNI-APP-X 
		// appVersion 可能是数字（plus.runtime.version）或字符串（systemInfo.appVersion），需要转换为字符串
		const appVersionStr = String(appVersion || '')
		if (typeof appId === 'string' && appVersionStr.length > 0 && appId.length > 0) {
			// 获取 WGT 版本信息
			// plus.runtime.getProperty 需要使用 plus.runtime.appid（生产环境）或 systemInfo.appId（开发环境）
			// 优先使用 plus.runtime.appid，如果它是 "HBuilder"（开发环境），则使用 systemInfo.appId
			let runtimeAppId = plus.runtime.appid
			if (!runtimeAppId || runtimeAppId === 'HBuilder') {
				runtimeAppId = systemInfo.appId || '__UNI__E0A1A41'
				console.log('📱 [热更新] call-check-version: plus.runtime.appid 不可用，使用 systemInfo.appId:', runtimeAppId)
			} else {
				console.log('📱 [热更新] call-check-version: 使用 plus.runtime.appid 获取 WGT 版本:', runtimeAppId)
			}
			
			plus.runtime.getProperty(runtimeAppId, function (widgetInfo) {
				console.log('📱 [热更新] call-check-version: plus.runtime.getProperty 回调，widgetInfo:', widgetInfo)
				// 如果 widgetInfo.version 为空，使用默认值 '0.0.0'，这样至少可以查询原生包
				const wgtVersion = widgetInfo && widgetInfo.version ? widgetInfo.version : '0.0.0'
				console.log('📱 [热更新] call-check-version: WGT 版本号:', wgtVersion, '(如果为空则使用默认值 0.0.0)')
				console.log('📱 [热更新] call-check-version: 准备调用云函数检查更新，参数:', {
					appid: appId,
					appVersion: appVersion,
					wgtVersion: wgtVersion
				})
				let data = {
					action: 'checkVersion',
					appid: appId,
					appVersion: appVersionStr,
					wgtVersion: wgtVersion
				}
				console.log('📱 [热更新] call-check-version: 调用云函数参数详情:', JSON.stringify(data, null, 2))
				uniCloud.callFunction({
					name: 'uni-upgrade-center',
					data,
					success: (e) => {
						console.log('📱 [热更新] call-check-version: 云函数调用成功，返回结果:', e.result)
						// 如果返回 code < 0，添加更详细的提示
						if (e.result && e.result.code < 0) {
							console.warn('⚠️ [热更新] 云函数返回错误码:', e.result.code, '消息:', e.result.message)
							if (e.result.code === -101) {
								console.warn('⚠️ [热更新] 提示：请检查数据库中是否存在以下条件的版本记录：')
								console.warn('   - appid:', appId)
								console.warn('   - platform: Android/iOS/Harmony（根据当前平台）')
								console.warn('   - stable_publish: true')
								console.warn('   - type: "wgt" 或 "native_app"')
							}
						}
						resolve(e.result as UniUpgradeCenterResult)
					},
					fail: (error) => {
						console.error('❌ [热更新] call-check-version: 云函数调用失败:', error)
						reject(error)
					}
				})
			})
		} else {
			reject('plus.runtime.appid is EMPTY')
		}
		// #endif
		// #ifdef UNI-APP-X
		if (typeof appId === 'string' && typeof appVersion === 'string' && appId.length > 0 && appVersion.length > 0) {
			let data = {
				action: 'checkVersion',
				appid: appId,
				appVersion: appVersion,
				is_uniapp_x: true,
				wgtVersion: '0.0.0.0.0.1'
			}
			try {
				uniCloud.callFunction({
					name: 'uni-upgrade-center',
					data: data
				}).then(res => {
					const code = res.result['code']
					const codeIsNumber = ['Int', 'Long', 'number'].includes(typeof code)
					if (codeIsNumber) {
					  if ((code as number) == 0) {
					    reject({
					      code: res.result['code'],
					      message: res.result['message']
					    })
					  } else if ((code as number) < 0) {
					    reject({
					      code: res.result['code'],
					      message: res.result['message']
					    })
					  } else {
              const result = JSON.parse(JSON.stringify(res.result)) as UniUpgradeCenterResult
              resolve(result)
            }
			
					}
				}).catch((err : any | null) => {
					const error = err as any
					if (error.errMsg == '未匹配到云函数[uni-upgrade-center]')
						error.errMsg = '【uni-upgrade-center-app】未配置uni-upgrade-center，无法升级。参考: https://uniapp.dcloud.net.cn/uniCloud/upgrade-center.html'
					reject(error.errMsg)
				})
			} catch (e) {
				reject(e.message)
			}
		} else {
			reject('invalid appid or appVersion')
		}
		// #endif
	})
	// #endif
	// #ifndef APP
	return new Promise((resolve, reject) => {
		reject({
			message: '请在App中使用'
		})
	})
	// #endif
}
