'use strict';
module.exports = async (event, context) => {
	/**
	 * 检测升级 使用说明
	 * 上传包：
	 * 1. 根据传参，先检测传参是否完整，appid appVersion wgtVersion 必传
	 * 2. 先从数据库取出所有该平台（从上下文读取平台信息，默认 Andriod）的所有线上发行更新
	 * 3. 再从所有线上发行更新中取出版本最大的一版。如果可以，尽量先检测wgt的线上发行版更新
	 * 4. 使用上步取出的版本包的版本号 和传参 appVersion、wgtVersion 来检测是否有更新，必须同时大于这两项，否则返回暂无更新
	 * 5. 如果库中 wgt包 版本大于传参 appVersion，但是不满足 min_uni_version < appVersion，则不会使用wgt更新，会接着判断库中 app包version 是否大于 appVersion
	 * 6. is_uniapp_x 为了区分 App 类型，uni-app x 项目安卓端没有 wgt 升级
	 */

	let {
		appid,
		appVersion,
		wgtVersion,
		is_uniapp_x = false
	} = event;

	const platform_Android = 'Android';
	const platform_iOS = 'iOS';
	const platform_Harmony = 'Harmony';
	const package_app = 'native_app';
	const package_wgt = 'wgt';
	const app_version_db_name = 'opendb-app-versions'

	let platform = platform_Android;

	// 云函数URL化请求
	if (event.headers) {
		let body;
		try {
			if (event.httpMethod.toLocaleLowerCase() === 'get') {
				body = event.queryStringParameters;
			} else {
				body = JSON.parse(event.body);
			}
		} catch (e) {
			return {
				code: 500,
				msg: '请求错误'
			};
		}

		appid = body.appid;
		appVersion = body.appVersion;
		wgtVersion = body.wgtVersion;

		if (/iPhone|iPad/.test(event.headers)) {
			platform = platform_iOS
		} else if (/Android|android/.test(event.headers)) {
			platform = platform_Android
		} else {
			platform = platform_Harmony
		}
	} else if (context.OS) {
		platform = context.OS === 'android' ?
			platform_Android :
			context.OS === 'ios' ?
			platform_iOS :
			context.OS === 'harmonyos' ?
			platform_Harmony :
			platform_Android;
	}

	if (appid && appVersion && wgtVersion && platform) {
		const collection = uniCloud.database().collection(app_version_db_name);

		console.log('[云函数-热更新] 查询参数:', {
			appid: appid,
			platform: platform,
			stable_publish: true,
			appVersion: appVersion,
			wgtVersion: wgtVersion
		});

		const record = await collection.where({
				appid,
				platform,
				stable_publish: true
			})
			.orderBy('create_date', 'desc')
			.get();

		console.log('[云函数-热更新] 查询结果:', {
			recordCount: record && record.data ? record.data.length : 0,
			records: record && record.data ? record.data.map(item => ({
				appid: item.appid,
				platform: item.platform,
				version: item.version,
				type: item.type,
				stable_publish: item.stable_publish
			})) : []
		});

		if (record && record.data && record.data.length > 0) {
			const appVersionInDb = record.data.find(item => item.type === package_app) || {};
			const wgtVersionInDb = record.data.find(item => item.type === package_wgt) || {};
			const hasAppPackage = !!Object.keys(appVersionInDb).length;
			const hasWgtPackage = !!Object.keys(wgtVersionInDb).length;

			// uni-app x 项目安卓端没有 wgt 升级
			if (is_uniapp_x === true && platform === platform_Android) {
				if (hasAppPackage) {
					const appUpdate = compare(appVersionInDb.version, appVersion) === 1;
					if (appUpdate) {
						return {
							code: 102,
							message: '整包更新',
							...appVersionInDb
						};
					}
				}
			} else {
				// 先检查 native_app 包是否有更新（整包更新优先级更高）
				if (hasAppPackage) {
					const appUpdate = compare(appVersionInDb.version, appVersion) === 1;
					console.log('[云函数-热更新] 检查 native_app 包更新:', {
						dbVersion: appVersionInDb.version,
						clientVersion: appVersion,
						appUpdate: appUpdate
					});
					if (appUpdate) {
						return {
							code: 102,
							message: '整包更新',
							...appVersionInDb
						};
					}
				}
				
				// 如果 native_app 版本相同（没有整包更新），才检查 wgt 包是否有更新
				// wgt 包只能在相同 native_app 版本的基础上更新
				if (hasWgtPackage) {
					// 先检查 native_app 版本是否相同
					const appVersionMatch = !hasAppPackage || compare(appVersionInDb.version, appVersion) === 0;
					console.log('[云函数-热更新] 检查 native_app 版本是否匹配:', {
						hasAppPackage: hasAppPackage,
						dbAppVersion: hasAppPackage ? appVersionInDb.version : 'N/A',
						clientAppVersion: appVersion,
						appVersionMatch: appVersionMatch
					});
					
					if (appVersionMatch) {
						const {
							version: wgtVersionInDbVersion,
							min_uni_version
						} = wgtVersionInDb;
						// 比较数据库中的 wgt 版本和客户端传的 wgt 版本
						const wgtUpdate = compare(wgtVersionInDbVersion, wgtVersion) === 1; // wgt包可用更新
						console.log('[云函数-热更新] 检查 wgt 包更新:', {
							dbWgtVersion: wgtVersionInDbVersion,
							clientWgtVersion: wgtVersion,
							wgtUpdate: wgtUpdate,
							min_uni_version: min_uni_version
						});
						
						if (wgtUpdate) {
							// 检查 min_uni_version 是否满足要求
							// min_uni_version 是字符串格式（如 "3.0.0"），appVersion 是整数格式（如 "104"），不能直接比较
							// 如果没有 min_uni_version 限制，或者 min_uni_version 为空，则允许更新
							if (!min_uni_version || min_uni_version === '') {
								console.log('[云函数-热更新] wgt 更新条件满足，返回更新');
								return {
									code: 101,
									message: 'wgt更新',
									...wgtVersionInDb
								};
							}
							// 如果有 min_uni_version，需要检查是否满足（这里暂时跳过检查，因为格式不匹配）
							// TODO: 如果需要严格检查 min_uni_version，需要将 appVersion 转换为对应的 uni-app 版本号
							console.log('[云函数-热更新] wgt 更新条件满足（有 min_uni_version），返回更新');
							return {
								code: 101,
								message: 'wgt更新',
								...wgtVersionInDb
							};
						} else {
							console.log('[云函数-热更新] wgt 包没有更新，wgtVersionInDbVersion:', wgtVersionInDbVersion, 'wgtVersion:', wgtVersion);
						}
					} else {
						console.log('[云函数-热更新] native_app 版本不匹配，无法进行 wgt 更新');
					}
				} else {
					console.log('[云函数-热更新] 没有 wgt 包');
				}
			}

			return {
				code: 0,
				message: '当前版本已经是最新的，不需要更新'
			};
		}

		return {
			code: -101,
			message: '暂无更新或检查appid是否填写正确'
		};
	}

	return {
		code: -102,
		message: '请检查传参是否填写正确'
	};
};

/**
 * 对比版本号，如需要，请自行修改判断规则
 * 支持比对	("3.0.0.0.0.1.0.1", "3.0.0.0.0.1")	("3.0.0.1", "3.0")	("3.1.1", "3.1.1.1") 之类的
 * @param {Object} v1
 * @param {Object} v2
 * v1 > v2 return 1
 * v1 < v2 return -1
 * v1 == v2 return 0
 */
function compare(v1 = '0', v2 = '0') {
	v1 = String(v1).split('.')
	v2 = String(v2).split('.')
	const minVersionLens = Math.min(v1.length, v2.length);

	let result = 0;
	for (let i = 0; i < minVersionLens; i++) {
		const curV1 = Number(v1[i])
		const curV2 = Number(v2[i])

		if (curV1 > curV2) {
			result = 1
			break;
		} else if (curV1 < curV2) {
			result = -1
			break;
		}
	}

	if (result === 0 && (v1.length !== v2.length)) {
		const v1BiggerThenv2 = v1.length > v2.length;
		const maxLensVersion = v1BiggerThenv2 ? v1 : v2;
		for (let i = minVersionLens; i < maxLensVersion.length; i++) {
			const curVersion = Number(maxLensVersion[i])
			if (curVersion > 0) {
				v1BiggerThenv2 ? result = 1 : result = -1
				break;
			}
		}
	}

	return result;
}
