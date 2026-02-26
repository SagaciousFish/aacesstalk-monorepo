## Why

AACessTalk 需要在浏览器中运行以便更方便的测试和演示。目前只有 React Native CLI 版本 (client-rn)，需要添加 Web 支持使其可以部署为网页应用。

## What Changes

1. **添加 react-native-web 依赖**
   - 在 `apps/client-rn/package.json` 添加 `react-native-web` 和相关依赖

2. **配置 Metro 支持 Web 平台**
   - 修改 `metro.config.js` 支持 web 平台
   - 可能需要添加别名处理不兼容的 native 模块

3. **添加 Webpack 构建配置**
   - 创建或更新 Webpack 配置用于 web 构建

4. **添加 Web 运行脚本**
   - 在 `package.json` 添加 `web` 命令
   - 使用 Metro + React Native DOM

## Capabilities

### New Capabilities
- `client-rn-web`: 让 client-rn 应用能够在浏览器中运行

### Modified Capabilities
- 无

## Impact

- **修改的文件**:
  - `apps/client-rn/package.json` - 添加依赖
  - `apps/client-rn/metro.config.js` - 添加 web 平台支持
  - 可能需要 `apps/client-rn/webpack.config.js` 或其他 web 构建配置

- **依赖变更**:
  - 添加 `react-native-web`
  - 可能需要 `react-dom`（检查是否已存在）
  - 可能需要 `@bacons/react-dom` 或类似的兼容性包

- **不涉及**:
  - 不添加 Expo 依赖
  - 不修改现有业务逻辑
