# vue3 dcloud文档

首先强调下：vue3支持选项式！vue3不是只支持组合式！

以下列举迁移到 vue3，必须适配的几个点，vue2 项目才能正常运行在 vue3 上。更多查看完整的[非兼容特性列表](https://github.com/vuejs/vue-next/tree/master/packages/vue-compat#incompatible "非兼容特性列表")

## main.js

创建应用实例

```javascript 
// 之前 - Vue 2importVuefrom'vue'importAppfrom'./App'Vue.config.productionTip=false   // vue3 不再需要App.mpType='app'   // vue3 不再需要constapp=newVue({...App})app.$mount()
```


复制代码

## 环境变量

```typescript 
// 配置环境变量// 根目录.env文件 必须 VUE_APP_ 开头VUE_APP_SOME_KEY=123// 获取环境变量process.env.NODE_ENV        // 应用运行的模式process.env.VUE_APP_SOME_KEY// 123
```


复制代码

**Tips**

- Vue2 更多 [设置环境变量方式](https://uniapp.dcloud.net.cn/tutorial/env.html#env "设置环境变量方式")
- Vue3 非H5端，应直接访问 process.env.\* 获取环境变量，不支持访问 process

## 全局属性

例如：全局网络请求

```javascript 
// 之前 - Vue 2Vue.prototype.$http=()=>{};// 之后 - Vue 3constapp=createApp({});app.config.globalProperties.$http=()=>{};
```


复制代码

## 插件使用

例如：使用 vuex 的 store

```javascript 
// 之前 - Vue 2importstorefrom"./store";Vue.prototype.$store=store;// 之后 - Vue 3importstorefrom"./store";constapp=createApp(App);app.use(store);
```


复制代码

## 项目根目录必需创建 index.html 文件

粘贴复制如下内容：

```html 
<!DOCTYPEhtml><htmllang="en"><head><metacharset="UTF-8"/><metaname="viewport"content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"/><title></title><!--preload-links--><!--app-context--></head><body><divid="app"><!--app-html--></div><scripttype="module"src="/main.js"></script></body></html>
```


复制代码

## 只支持使用 ES6 模块规范

commonJS 需改为 ES6 模块规范

### 模块导入

```javascript 
// 之前 - Vue 2, 使用 commonJSvarutils=require("../../../common/util.js");// 之后 - Vue 3， 只支持 ES6 模块importutilsfrom"../../../common/util.js";
```


复制代码

### 模块导出

```javascript 
// 之前 - Vue 2, 依赖如使用 commonJS 方式导出module.exports.X=X;// 之后 - Vue 3， 只支持 ES6 模块exportdefault{X};
```


复制代码

## vuex 用法

```typescript 
importVuefrom"vue";importVuexfrom"vuex";Vue.use(Vuex);conststore=newVuex.Store({state:{},});exportdefaultstore;
```


复制代码

## 避免在同一元素上同时使用 v-if 与 v-for

而 Vue3 中，v-if 总是优先于 v-for 生效。以上写法将会在 Vue3 中与预期不符合，由于语法上存在歧义，建议避免在同一元素上同时使用两者（[更多](https://v3.cn.vuejs.org/guide/migration/v-if-v-for.html#概览 "更多")）。

## 生命周期的适配

在 Vue3 中组件卸载的生命周期被重新命名

- `destroyed` 修改为 `unmounted`
- `beforeDestroy` 修改为 `beforeUnmount`

created 和 onLoad 生命周期执行顺序

created为组件生命周期，onLoad为页面生命周期。因此created执行先于onLoad更合理。

Vue3 在实现时 created 先于 onLoad 执行；Vue2 项目由于历史包袱较重不便修改，仅在使用组合式API时与Vue3对齐。

在编写代码时不应依赖 created 和 onLoad 生命周期执行顺序

## 事件的适配

Vue3 现在提供了一个`emits`选项，类似于现有`props`选项。此选项可用于定义组件可以向其父对象发出的事件， [更多](https://v3.cn.vuejs.org/guide/migration/emits-option.html#overview "更多")

**强烈建议使用**\*\*`emits`\*\***记录每个组件发出的所有事件。**

这一点特别重要，因为去除了`.native`修饰符。`emits` 现在在未使用声明的事件的所有侦听器都将包含在组件的中`$attrs`，默认情况下，该侦听器将绑定到组件的根节点。

```javascript 
<template><button@click="onClick">OK</button></template><script>exportdefault{emits:["click"],methods:{onClick(){this.$emit("click","OK");},},};
</script>
```


复制代码

### Vue3 项目部分小程序端事件延迟或调用失败

可在执行事件的元素上添加 `data-eventsync="true"` 属性以解决此问题，如：

```javascript 
<template><button@click="onClick"data-eventsync="true">OK</button></template>
```


复制代码

## v-model 的适配

Vue3 的 v-model 相对 Vue2 来说 ，有了较大的改变。可以使用多 `model`,相应语法也有变化。[更多](https://v3.cn.vuejs.org/guide/migration/v-model.html#概览 "更多")

### 修改 modelValue

用于自定义组件时，Vue3 v-model prop 和事件默认名称已更改 `props.value` 修改为 `props.modelValue` ,`event.value` 修改为 `update:modelValue`

```javascript 
exportdefault{props:{// value:String,// 替换 value 为 modelValuemodelValue:String,},};
```


复制代码

## 事件返回

将之前的 `this.$emit('input')` 修改为 `this.$emit('update:modelValue')` ，vue3 中将省略这一步骤

自定义组件上的 v-model 相当于传递了 modelValue prop 并接收抛出的 update:modelValue 事件：

```javascript 
<ChildComponentv-model="pageTitle"/><!-- 是以下的简写: --><ChildComponent:modelValue="pageTitle"@update:modelValue="pageTitle = $event"/>
```


复制代码

若需要更改 model 名称，作为组件内 model 选项的替代，现在我们可以将一个 argument 传递给 v-model：

```html 
<ChildComponentv-model:title="pageTitle"/><!-- 是以下的简写: --><ChildComponent:title="pageTitle"@update:title="pageTitle = $event"/>
```


复制代码

## 插槽的适配

Vue3 将不支持 `slot="xxx"` 的用法 ，请使用 `v-slot:xxx` 用法。[更多](https://v3.cn.vuejs.org/guide/component-slots.html#具名插槽 "更多")

```react jsx 
<!--  Vue2 支持的用法 --><uni-nav-bar><viewslot="left"class="city"><!-- ... --></view></uni-nav-bar>
```


复制代码

## 不再支持过滤器

从 Vue 3.0 开始，过滤器已删除，不再支持，建议用方法调用或计算属性替换它们。[更多](https://v3.cn.vuejs.org/guide/migration/filters.html#概览 "更多")

## API `Promise 化` 调用结果的方式

在 Vue3 中，处理 API `Promise 化` 调用结果的方式不同于 Vue2。[更多](https://uniapp.dcloud.io/api/#api-promise-化 "更多")

- Vue3 中，调用成功会进入 then 方法，调用失败会进入 catch 方法
- Vue2 中，调用无论成功还是失败，都会进入 then 方法，返回数据的第一个参数是错误对象，第二个参数是返回数据

### 转换方法

```javascript 
// Vue 2 转 Vue 3, 在 main.js 中写入以下代码即可functionisPromise(obj){return(!!obj&&(typeofobj==="object"||typeofobj==="function")&&typeofobj.then==="function");}uni.addInterceptor({returnValue(res){if(!isPromise(res)){returnres;}returnnewPromise((resolve, reject)=>{res.then((res)=>{if(!res){resolve(res)return;}if(res[0]){reject(res[0]);}else{resolve(res[1]);}});});},});
```


复制代码

## 生命周期钩子的组合式 API 使用方式

在 Vue3 组合式 API 中，也需要遵循 uni-app 生命周期钩子规范, 如 onLaunch 等应用生命周期仅可在 App.vue 中监听，使用中请注意生命周期钩子的适用范围。[查看全部生命周期钩子](https://uniapp.dcloud.net.cn/collocation/frame/lifecycle "查看全部生命周期钩子")

只能在 `<script setup>` 单文件语法糖或 `setup()` 方法中使用生命周期钩子，以 A 页面跳转 B 页面传递参数为例：

```typescript 
// 从 A 页面跳转 B 页面时传递参数 ?id=1&name=uniapp，xxx 为跳转的页面路径//uni.navigateTo({//  url: 'xxx?id=1&name=uniapp'//})// 方法一：在 B 页面 <script setup> 中<script setup>import{onLoad,onShow}from"@dcloudio/uni-app";// onLoad 接受 A 页面传递的参数onLoad((option)=>{console.log("B 页面 onLoad:",option);//B 页面 onLoad: {id: '1', name: 'uniapp'}});onShow(()=>{console.log("B 页面 onShow");});</script>
```


复制代码

## `$mp` 调整为 `$scope`

在 Vue3 中，this 对象下的 `$mp` 调整为 `$scope`

## 在 nvue 使用 Vuex

在 Vue3 中，如果 nvue 使用了 Vuex 的相关 API，需要在 main.js 的 createApp 的返回值中 return 一下 Vuex 示例：

```javascript 
importVuexfrom"vuex";exportfunctioncreateApp(){constapp=createSSRApp(App);app.use(store);return{app,Vuex,// 如果 nvue 使用 vuex 的各种map工具方法时，必须 return Vuex};}
```


复制代码

## 需主动开启 sourcemap

App，小程序端源码调试，需要在 vite.config.js 中主动开启 sourcemap

```typescript 
import{defineConfig}from"vite";importunifrom"@dcloudio/vite-plugin-uni";/**
 * @type {import('vite').UserConfig}
 */exportdefaultdefineConfig({build:{sourcemap:true,},plugins:[uni()],});
```


复制代码

## 小程序平台

### 监听原生的点击事件

在 vue3 的小程序平台中，监听原生的点击事件可以先使用 tap。 在 vue3 中，移除了.native 修饰符，所以编译器无法预知 click 是要触发原生事件，还是组件的自定义事件，故并未转换成小程序的 tap 事件。

### style

vue3 出于性能考虑，style 中暂不支持 div、p 等 HTML 标签选择器，推荐使用 class 选择器，[template 中的 HTML 标签仍会进行转换](https://uniapp.dcloud.net.cn/vernacular.html#组件-标签的变化 "template 中的 HTML 标签仍会进行转换")。

### 真机调试

- vue3 微信开发者工具真机调试页面空白，如[帖子](https://ask.dcloud.net.cn/question/162915 "帖子")
- vue3 微信小程序真机调试，如[帖子](https://ask.dcloud.net.cn/question/173162 "帖子")

均可以通过在 manifest.json 的 `mp-weixin` 中配置 `minified` 为 `true` 来解决

```json 
{"mp-weixin":{"setting":{// ...其他配置"minified":true}}}
```


复制代码

## vue3 支持的手机版本最低到多少？

> 4.4（具体因系统 webview 版本而异，原生安卓系统升级过系统 webview 一般 5.0 即可，国产安卓系统未使用 x5 内核时一般需 7.0 以上）, ios >= 10

> Android < 4.4，配置 X5 内核支持，首次需要联网下载，可以配置下载 X5 内核成功后启动应用，[详情](https://uniapp.dcloud.net.cn/collocation/manifest.html#appwebview "详情")

## 小程序自定义组件

web 平台、app 平台 vue3 项目不再支持小程序自定义组件

## vue3 nvue 暂不支持 recycle-list 组件

vue3 nvue 暂不支持 recycle-list 组件

## h5 平台发行时，会默认启动摇树

vue3 在 h5 平台发行时，为了优化包体积大小，会默认启动摇树，仅打包明确使用的 api， 如果要关闭摇树，可以在 manifest.json 中配置：

```json 
"h5":{"optimization":{"treeShaking":{"enable":false}}}
```


复制代码

## 通过 props 来获取页面参数

vue3 全平台新增：通过 props 来获取页面参数的使用方式

```typescript 
<scriptsetup>// 页面可以通过定义 props 来直接接收 url 传入的参数// 如：uni.navigateTo({ url: '/pages/index/index?id=10' })constprops=defineProps({id:String,});console.log("id="+props.id);// id=10
</script>
```


复制代码

```javascript 
<script>// 页面可以通过定义 props 来直接接收 url 传入的参数// 如：uni.navigateTo({ url: '/pages/index/index?id=10' })exportdefault{props:{id:{type:String,},},setup(props){console.log("id="+props.id);// id=10},};
</script>
```


复制代码

## 小程序和App端不支持插值方式定义国际化

因运行平台限制，目前在小程序和 App 端不支持插值方式定义国际化,需要使用 Messages Functions 定义国际化信息，[参考文档](https://vue-i18n.intlify.dev/guide/advanced/function.html "参考文档")

示例：

```typescript 
constmessages={en:{greeting:({named})=>`hello, ${named('name')}!`}}
```


复制代码

```javascript 
<template><view>{{ $t('greeting', { name: 'uniapp' }) }}</view></template>
```


复制代码

## sass预处理器

参考：[css预处理器支持](https://uniapp.dcloud.net.cn/tutorial/syntax-css.html#css-preprocessor "css预处理器支持")

因为`node-sass`已经停止维护，所以`vue3`默认使用`dart-sass`。

从 HBuilderX 4.56+ ，vue2 项目也将默认使用`dart-sass`预编译器。

### 升级方式

```markdown 
# 卸载已安装的 node-sass
npm uninstall node-sass 
# 安装 dart-sass
npm install sass --save-dev 
```


复制代码

### node-sass升级dart-sass常见问题及改进方法

- SassError: expected selector. /deep/

> 解决方案：/deep/ 替换成::v-deep

- WARNING: Using / for division is deprecated and will be removed in Dart Sass 2.0.0.

> 解决方案：使用 math.div() 替换除法运算符 详情，如果遇到@use 'sass:math';编译报错，可以在uni.scss中定义，详情

- SassError: xxx and xxx are incompatible.

> 解决方案：calc 在特定情况需要带单位，比如：width: calc(100% - 215) 修改为：width: calc(100% - 215px)
