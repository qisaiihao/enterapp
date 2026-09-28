文本安全内容检测接口
这是接口基于HTTPS协议。开发者服务器可以调用此接口校验一段文本是否含有敏感信息。

应用场景举例
用户个人资料违规文字检测；媒体新闻类用户发表文章，评论内容检测；游戏类用户编辑上传的素材(如答题类小游戏用户上传的问题及答案)检测等。

频率限制
单个appid调用上限为2000次/分钟，1,000,000次/天

调用示例
curl -d '{ "content":"hello world!" }' 
'https://api.weixin.qq.com/wxa/msg_sec_check?access_token=ACCESS_TOKEN'
请求参数
参数	类型	必填	说明
access_token	String	是	调用接口凭证
content	String	是	要检测的文本内容，长度不超过500K字节
返回参数
参数	类型	说明
errcode	int	错误码
errmsg	String	错误说明
返回说明：

//正常返回0
{
      "errcode": "0",
      "errmsg": "ok"
}

//当content内含有敏感信息，则返回87014
{
    "errcode": 87014,
    "errmsg": "risky content"
}

//其余错误见返回码说明
{
    "errcode": 40001,
    "errmsg": "invalid credential, access_token is invalid or not latest"
}
图片安全内容检测接口
这是接口基于HTTPS协议。开发者服务器可以调用此接口校验一张图片是否含有敏感信息。

应用场景举例
1）图片智能鉴黄：涉及拍照的工具类应用(如美拍，识图类应用)用户拍照上传检测；电商类商品上架图片检测；媒体类用户文章里的图片检测等。

2）敏感人脸识别：用户头像；媒体类用户文章里的图片检测；社交类用户上传的图片检测等。

频率限制
单个appid调用上限为1000次/分钟，100,000次/天

调用示例
curl -F media=@test.jpg 
'https://api.weixin.qq.com/wxa/img_sec_check?access_token=ACCESS_TOKEN'
请求参数
参数	类型	必填	说明
access_token	String	是	调用接口凭证
media	Form-Data	是	要检测的图片文件，格式支持PNGJPEGJPGGIF, 像素不超过750x1334
返回参数
参数	类型	说明
errcode	int	错误码
errmsg	String	错误说明
返回说明：

//正常返回0
{
      "errcode": "0",
      "errmsg": "ok"
}

//当图片文件内含有敏感内容，则返回87014
{
    "errcode": 87014,
    "errmsg": "risky content"
}

//其余错误见返回码说明
{
    "errcode": 40001,
    "errmsg": "invalid credential, access_token is invalid or not latest"
}


文本内容安全识别
 调试诊断

接口应在服务器端调用，不可在前端（小程序、网页、APP等）直接调用，具体可参考接口调用指南。

接口英文名：msgSecCheck

该接口用于检查一段文本是否含有违法违规内容。

应用场景：

用户个人资料违规文字检测；
媒体新闻类用户发表文章，评论内容检测；
游戏类用户编辑上传的素材(如答题类小游戏用户上传的问题及答案)检测等。

1. 调用方式
HTTPS 调用
POST https://api.weixin.qq.com/wxa/msg_sec_check?access_token=ACCESS_TOKEN
支持加密请求： 本接口支持服务通信二次加密和签名，可有效防止数据篡改与泄露。查看详情

云调用
调用方法：security.msgSecCheck

出入参和 HTTPS 调用相同，调用方式可查看 云调用 说明文档。

第三方调用
本接口支持第三方平台代商家调用。

该接口所属的权限集 id 为：18

服务商获得其中之一权限集授权后，可通过使用 authorizer_access_token 代商家进行调用，具体可查看 第三方调用 说明文档。


2. 请求参数
查询参数 Query String Parameters
参数名	类型	必填	说明
access_token	string	是	接口调用凭证，可使用 access_token、authorizer_access_token
请求体 Request Payload
参数名	类型	必填	说明
content	string	是	需检测的文本内容，文本字数的上限为2500字，需使用UTF-8编码
version	number	是	接口版本号，2.0版本为固定值2
scene	number	是	场景枚举值（1 资料；2 评论；3 论坛；4 社交日志）
openid	string	是	用户的openid（用户需在近两小时访问过小程序）
title	string	否	文本标题，需使用UTF-8编码
nickname	string	否	用户昵称，需使用UTF-8编码
signature	string	否	个性签名，该参数仅在资料类场景有效(scene=1)，需使用UTF-8编码

3. 返回参数
返回体 Response Payload
参数名	类型	说明
errcode	number	错误码
errmsg	string	错误信息
detail	objarray	详细检测结果
trace_id	string	唯一请求标识，标记单次请求
result	object	综合结果

Res.detail(Array) Object Payload
详细检测结果

参数名	类型	说明
strategy	string	策略类型
errcode	number	错误码，仅当该值为0时，该项结果有效
suggest	string	建议，有risky、pass、review三种值
label	number	命中标签枚举值，100 正常；10001 广告；20001 时政；20002 色情；20003 辱骂；20006 违法犯罪；20008 欺诈；20012 低俗；20013 版权；21000 其他
keyword	string	命中的自定义关键词
prob	number	0-100，代表置信度，越高代表越有可能属于当前返回的标签（label）

Res.result Object Payload
综合结果

参数名	类型	说明
suggest	string	建议，有risky、pass、review三种值
label	number	命中标签枚举值，100 正常；10001 广告；20001 时政；20002 色情；20003 辱骂；20006 违法犯罪；20008 欺诈；20012 低俗；20013 版权；21000 其他

4. 注意事项
-1.0 版本接口文档【点击查看】，1.0版本在2021年9月1日停止更新，请尽快更新至2.0

频率限制：单个 appId 调用上限为 4000 次/分钟，2,000,000 次/天。

5. 代码示例
5.1 HTTPS调用
请求示例

{
  "openid": "OPENID",
  "scene": 1,
  "version": 2,
  "content": "hello world!"
}
返回示例

{
  "errcode": 0,
  "errmsg": "ok",
  "result": {
    "suggest": "risky",
    "label": 20001
  },
  "detail": [
    {
      "strategy": "content_model",
      "errcode": 0,
      "suggest": "risky",
      "label": 20006,
      "prob": 90
    },
    {
      "strategy": "keyword",
      "errcode": 0,
      "suggest": "pass",
      "label": 20006,
      "level": 20,
      "keyword": "命中的关键词1"
    },
    {
      "strategy": "keyword",
      "errcode": 0,
      "suggest": "risky",
      "label": 20006,
      "level": 90,
      "keyword": "命中的关键词2"
    }
  ],
  "trace_id": "60ae120f-371d5872-7941a05b"
}
5.2 云函数调用
请求示例

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})
exports.main = async (event, context) => {
  try {
    const result = await cloud.openapi.security.msgSecCheck({
        "openid": 'OPENID',
        "scene": 1,
        "version": 2,
        "content": 'hello world!'
      })
    return result
  } catch (err) {
    return err
  }
}
返回示例

{
  "errcode": 0,
  "errmsg": "ok",
  "result": {
    "suggest": "risky",
    "label": 20001
  },
  "detail": [
    {
      "strategy": "content_model",
      "errcode": 0,
      "suggest": "risky",
      "label": 20006,
      "prob": 90
    },
    {
      "strategy": "keyword",
      "errcode": 0,
      "suggest": "pass",
      "label": 20006,
      "level": 20,
      "keyword": "命中的关键词1"
    },
    {
      "strategy": "keyword",
      "errcode": 0,
      "suggest": "risky",
      "label": 20006,
      "level": 90,
      "keyword": "命中的关键词2"
    }
  ],
  "trace_id": "60ae120f-371d5872-7941a05b"
}

6. 错误码
以下是本接口的错误码列表，其他错误码可参考 通用错误码；调用接口遇到报错，可使用官方提供的 API 诊断工具 辅助定位和分析问题。

错误码	错误描述	解决方案
-1	system error	系统繁忙，此时请开发者稍候再试
40001	invalid credential  access_token isinvalid or not latest	access_token 无效或不为最新获取的 access_token，请开发者确认access_token的有效性
40003	invalid openid	不合法的 OpenID ，请开发者确认 OpenID 的有效性
40129	invalid scene	场景值错误（目前支持场景 1 资料；2 评论；3 论坛；4 社交日志）
43002	require POST method	方法调用错误，请用 post 方法调用
43104	The openid does not match the appid	appid与 openid 不匹配
44002	empty post data	POST 的数据包为空。post请求body参数不能为空。
44991	reach max api minute frequence	超出接口每分钟调用限制
45009	reach max api daily quota limit	超出接口每日调用限制
47001	data format error	解析 JSON/XML 内容错误;post 数据中参数缺失;检查修正后重试。
61010	code is expired	用户访问记录超时（用户未在近两小时访问小程序）


1. 调用方式
HTTPS 调用
POST https://api.weixin.qq.com/wxa/media_check_async?access_token=ACCESS_TOKEN
支持加密请求： 本接口支持服务通信二次加密和签名，可有效防止数据篡改与泄露。查看详情

云调用
调用方法：security.mediaCheckAsync

出入参和 HTTPS 调用相同，调用方式可查看 云调用 说明文档。

第三方调用
本接口支持第三方平台代商家调用。

该接口所属的权限集 id 为：18

服务商获得其中之一权限集授权后，可通过使用 authorizer_access_token 代商家进行调用，具体可查看 第三方调用 说明文档。


2. 请求参数
查询参数 Query String Parameters
参数名	类型	必填	说明
access_token	string	是	接口调用凭证，可使用 access_token、authorizer_access_token
请求体 Request Payload
参数名	类型	必填	说明
media_url	string	是	要检测的图片或音频的url，支持图片格式包括jpg, jpeg, png, bmp, gif（取首帧），支持的音频格式包括mp3, aac, ac3, wma, flac, vorbis, opus, wav
media_type	number	是	1:音频;2:图片
version	number	是	接口版本号，2.0版本为固定值2
scene	number	是	场景枚举值（1 资料；2 评论；3 论坛；4 社交日志）
openid	string	是	用户的openid（用户需在近两小时访问过小程序）

3. 返回参数
返回体 Response Payload
参数名	类型	说明
errcode	number	错误码
errmsg	string	错误信息
trace_id	string	唯一请求标识，标记单次请求，用于匹配异步推送结果

4. 注意事项
media_type 需要准确填写 url 对应的多媒体类型，media_url 需要保证可以被检测服务器下载。

异步检测结果推送
异步检测结果在 30 分钟内会推送到你的消息接收服务器。点击查看消息接收服务器配置

返回的 JSON 数据包

属性	类型	说明
ToUserName	string	小程序的username
FromUserName	string	平台推送服务UserName
CreateTime	number	发送时间
MsgType	string	默认为：event
Event	string	默认为：wxa_media_check
appid	string	小程序的appid
trace_id	string	任务id
version	number	可用于区分接口版本
errcode	number	错误码，仅当该值为0时，结果有效。该值为-1008时表示下载错误，请检查媒体链接是否有效。
result	object	综合结果
detail	array	详细检测结果
result为综合结果，包含的属性有

属性	类型	说明
suggest	string	建议，有risky、pass、review三种值
label	number	命中标签枚举值，100 正常；20001 时政；20002 色情；20006 违法犯罪；21000 其他
detail为详细检测结果，包含的属性有

属性	类型	说明
strategy	string	策略类型
errcode	number	错误码，仅当该值为0时，该项结果有效
suggest	string	建议，有risky、pass、review三种值
label	number	命中标签枚举值，100 正常；20001 时政；20002 色情；20006 违法犯罪；21000 其他
prob	number	0-100，代表置信度，越高代表越有可能属于当前返回的标签（label）
异步检测结果推送示例
{
   "ToUserName": "gh_9df7d78a1234",
   "FromUserName": "o4_t144jTUSEoxydysUA2E234_tc",
   "CreateTime": 1626959646,
   "MsgType": "event",
   "Event": "wxa_media_check",
   "appid": "wx8f16a5be77871234",
   "trace_id": "60f96f1d-3845297a-1976a3ae",
   "version": 2,
   "detail": [{
        "strategy": "content_model",
        "errcode": 0,
        "suggest": "pass",
        "label": 100,
        "prob": 90
   }],
   "errcode": 0,
   "errmsg": "ok",
   "result": {
        "suggest": "pass",
        "label": 100
   }
}

5. 代码示例
请求示例

{
  "openid": "OPENID",
  "scene": 1,
  "version": 2,
  "media_url": "https://developers.weixin.qq.com/miniprogram/assets/images/head_global_z_@all.png",
  "media_type": 2
}
返回示例

{
  "errcode": 0,
  "errmsg": "ok",
  "trace_id": "60f96f1d-3845297a-1976a3ae"
}

6. 错误码
以下是本接口的错误码列表，其他错误码可参考 通用错误码；调用接口遇到报错，可使用官方提供的 API 诊断工具 辅助定位和分析问题。

错误码	错误描述	解决方案
-1	system error	系统繁忙，此时请开发者稍候再试
40001	invalid credential  access_token isinvalid or not latest	access_token 无效或不为最新获取的 access_token，请开发者确认access_token的有效性
40003	invalid openid	不合法的 OpenID ，请开发者确认 OpenID 的有效性
40004	invalid media type	media type错误（目前支持多媒体类型 1 音频；2 图片）
43104	The openid does not match the appid	appid与 openid 不匹配
44991	reach max api minute frequence	超出接口每分钟调用限制
45009	reach max api daily quota limit	超出接口每日调用限制
61010	code is expired	用户访问记录超时（用户未在近两小时访问小程序）
87020	repeat request limit exceeded	重复请求超出接口调用限制

