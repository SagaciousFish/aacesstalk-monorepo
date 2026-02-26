## Context

当前 client-rn 是纯 React Native CLI 应用，只能在 iOS/Android 上运行。需要添加 Web 支持，使其能够在浏览器中运行用于测试和演示。

现有配置：
- Metro bundler 配置在 `metro.config.js`
- 使用 NativeWind (Tailwind CSS)
- 使用 react-native-reanimated
- 已包含 `react-dom` 但未使用

## Goals / Non-Goals

**Goals:**
- 让 client-rn 能在 Chrome/Edge/Safari 等现代浏览器中运行
- 保持现有的 React Native 代码不变
- 添加最小的额外依赖

**Non-Goals:**
- 不添加 Expo 依赖
- 不修改现有业务逻辑
- 不支持所有 native 功能（如相机、GPS等在 web 上不可用的功能）

## Decisions

### 1. 使用 react-native-web 而非 RN 0.76+ 内置 Web

**选择**: `react-native-web`

**理由**:
- 更成熟，文档更完善
- 支持更多的 React Native 组件
- 社区支持更好

### 2. Webpack 配置方式

**选择**: 使用 React Native Community 官方推荐的 `@react-native-community/cli` + Metro

**理由**:
- 与现有 Metro 配置兼容
- 不需要额外的 webpack 配置
- RN 官方维护

### 3. Metro 配置修改

需要在 `metro.config.js` 中：
- 添加 `platforms: ['ios', 'android', 'web']`
- 添加 `resolver.platforms`
- 配置 webpack alias 处理不兼容模块

## Risks / Trade-offs

### 1. 部分 Native 模块 Web 不支持

**[风险]**: 某些 React Native 模块（如 `react-native-audio-recorder-player`）在 web 上不可用

**[缓解]**: 使用条件导入或 polyfill，Web 版本使用浏览器原生 API

### 2. 构建大小

**[风险]**: Web 打包可能较大

**[缓解]**: 使用 production build 优化

### 3. 样式兼容性

**[风险]**: NativeWind 在 web 上的行为可能与原生有细微差异

**[缓解]**: 测试关键 UI 组件
