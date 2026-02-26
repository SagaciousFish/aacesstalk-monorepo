## 1. 添加依赖

- [x] 1.1 在 `apps/client-rn/package.json` 添加 `react-native-web` 依赖
  - 添加了 `react-native-web`
  - 添加了 `@react-native-community/cli`
- [x] 1.2 确认 `react-dom` 已存在（检查版本兼容性）
  - react-dom 已存在 (line 29)

## 2. 配置 Metro

- [x] 2.1 修改 `metro.config.js` 添加 web 平台支持
  - 添加 `platforms: ['ios', 'android', 'web']`
  - 添加 `resolverMainFields` 优先顺序

## 3. 添加运行脚本

- [x] 3.1 在 `apps/client-rn/package.json` 添加 `web` 脚本
  - 更新为使用 webpack（而非 Metro，因为 Metro CLI 不直接支持 web 平台）
  - `npm run web` → `webpack serve --config webpack.standalone.config.js`
  - `npm run web:build` → `webpack --config webpack.standalone.config.js --mode production`
- [x] 3.2 在 `project.json` 添加 web 相关 target
  - 添加了 `web` 和 `web:build` targets

## 4. 配置 Web Mocks

- [x] 4.1 创建完整的 Web 实现
  - **audio-recorder-player.js** - Web Audio API / MediaRecorder API (真实录音功能)
  - **sound-player.js** - HTML5 Audio API (真实音频播放)
  - **mmkv.js** - IndexedDB (持久化键值存储)
  - **file-access.js** - IndexedDB (持久化文件系统)
  - **blob-util.js** - IndexedDB (Blob 操作)
  - **device-info.js** - 设备信息 (返回默认值)
  - **permissions.js** - 权限检查 (总是返回已授权)
  - **react-navigation-native.js** - Web 兼容导航
  - **react-navigation-native-stack.js** - Web 兼容栈导航
  - **requireNativeComponent.js** - Native 组件
  - **react-native-reanimated.js** - 动画库 (含 interpolateColor)
  - **react-native-safe-area-context.js** - 安全区域
  - **react-native-gesture-handler.js** - 手势处理
  - **react-native-localize.js** - 地区/时区
  - **react-native-toast-message.js** - 提示消息
  - **react-native-global-keyevent.js** - 键盘事件
  - **react-native-progress.js** - 进度指示器

- [x] 4.2 创建 webpack.standalone.config.js 处理所有兼容性问题
- [x] 4.3 使用 IndexedDB 替代 localStorage，实现真正持久化存储

## 5. 测试验证

- [x] 5.1 运行 `npm run web:build` 成功
- [x] 5.2 生产构建成功 (bundle.js 23.7MB 和 index.html 生成在 dist 目录)
- [x] 5.3 修复 Platform.OS 兼容性问题
  - App.tsx: 添加 web 平台的主机地址处理
  - HomeScreen.tsx: 添加 web 权限处理 case
  - TopicButton.tsx: 使用 iOS 风格的阴影 (非 android)
  - SignInScreen.tsx: 使用 iOS 风格的输入框 padding
  - navigation/main.tsx: 简化 statusBarHidden 逻辑
  - card-views.tsx: 使用 iOS 风格的阴影
- [x] 5.4 添加 @candlefinance/faster-image Web Mock
- [x] 5.5 运行 dev server 成功 (http://localhost:4200)
