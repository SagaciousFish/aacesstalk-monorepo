# AACessTalk 部署指南

本文档说明如何将 AACessTalk 应用部署到生产环境。

---

## 📋 部署前准备

### 1. 环境检查

```bash
# 检查 Node.js 版本
node --version  # 应该 >= 22

# 检查 npm 版本
npm --version

# 检查 Convex CLI
npx convex --version

# 检查 React Native 环境
npx react-native --version
```

### 2. 创建生产环境配置

创建 `.env.production` 文件：

```bash
# Convex 配置
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-id
CONVEX_PRODUCTION=true

# 后端地址（如果保留 FastAPI）
BACKEND_ADDRESS=https://api.aacesstalk.com

# API 密钥
OPENAI_API_KEY=your_openai_api_key
CLOVA_VOICE_API_KEY=your_clova_api_key
CLOVA_VOICE_SECRET=your_clova_secret
DEEPL_API_KEY=your_deepl_api_key

# 认证密钥
AUTH_SECRET=your_auth_secret
ADMIN_ID=admin
ADMIN_HASHED_PASSWORD=your_hashed_password
```

---

## 🚀 Convex 后端部署

### 1. 创建 Convex 项目

```bash
# 登录 Convex
npx convex login

# 创建生产部署
npx convex deploy
```

### 2. 配置环境变量

```bash
# 在 Convex dashboard 中设置环境变量
# https://dashboard.convex.dev

OPENAI_API_KEY=your_openai_api_key
CLOVA_VOICE_API_KEY=your_clova_api_key
CLOVA_VOICE_SECRET=your_clova_secret
DEEPL_API_KEY=your_deepl_api_key
```

### 3. 初始化卡片数据

```bash
# 部署后初始化卡片数据
curl -X POST https://your-convex-url/api/v1/dyad/cards/initialize
```

### 4. 验证部署

```bash
# 检查健康状态
curl -I https://your-convex-url/api/v1/ping

# 检查卡片统计
curl https://your-convex-url/api/v1/dyad/cards/stats
```

---

## 📱 React Native 应用部署

### Android 部署

#### 1. 配置签名

创建 `android/app/release.keystore`：

```bash
cd apps/client-rn/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

更新 `android/app/build.gradle`：

```gradle
android {
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword 'your_store_password'
            keyAlias 'my-key-alias'
            keyPassword 'your_key_password'
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

#### 2. 构建发布版本

```bash
cd apps/client-rn

# 构建 APK
npx react-native build-android --mode=release

# 或构建 AAB（推荐用于 Google Play）
npx react-native build-android --mode=release --bundle
```

#### 3. 上传到 Google Play

1. 登录 Google Play Console
2. 创建新应用
3. 上传 AAB 文件
4. 填写应用信息
5. 提交审核

### iOS 部署

#### 1. 配置签名

在 Xcode 中：
1. 打开 `ios/ClientRn.xcworkspace`
2. 选择项目 → Signing & Capabilities
3. 配置 Team 和 Bundle Identifier
4. 选择 "Automatically manage signing"

#### 2. 构建发布版本

```bash
cd apps/client-rn/ios

# 构建 Archive
xcodebuild -workspace ClientRn.xcworkspace -scheme ClientRn -configuration Release -archivePath build/ClientRn.xcarchive archive

# 导出 IPA
xcodebuild -exportArchive -archivePath build/ClientRn.xcarchive -exportPath build/export -exportOptionsPlist ExportOptions.plist
```

或在 Xcode 中：
1. Product → Archive
2. 等待构建完成
3. 点击 "Distribute App"
4. 选择分发方式（App Store、Ad Hoc、Enterprise）

#### 3. 上传到 App Store

1. 登录 App Store Connect
2. 创建新应用
3. 上传 IPA 文件
4. 填写应用信息
5. 提交审核

---

## 🔒 安全配置

### 1. API 密钥管理

**不要**将 API 密钥硬编码在代码中。

**推荐做法：**

```typescript
// ❌ 错误
const apiKey = "sk-1234567890";

// ✅ 正确
const apiKey = process.env.OPENAI_API_KEY;
```

### 2. 数据加密

```typescript
// 加密敏感数据
import CryptoJS from 'crypto-js';

const encrypted = CryptoJS.AES.encrypt(
  JSON.stringify(data),
  process.env.ENCRYPTION_KEY
).toString();

const decrypted = JSON.parse(
  CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
);
```

### 3. HTTPS 强制

```typescript
// 在生产环境中强制使用 HTTPS
if (process.env.NODE_ENV === 'production' && !window.location.protocol.startsWith('https')) {
  window.location.href = `https:${window.location.href.substring(window.location.protocol.length)}`;
}
```

---

## 📊 监控和日志

### 1. Convex 监控

访问 Convex Dashboard：
- https://dashboard.convex.dev

查看：
- 函数执行时间
- 错误日志
- 数据库查询
- 向量搜索性能

### 2. 应用监控

集成 Sentry 或 Firebase Crashlytics：

```bash
npm install @sentry/react-native
```

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV,
});
```

### 3. 性能监控

```typescript
import { PerformanceObserver } from 'perf_hooks';

const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});

observer.observe({ entryTypes: ['measure', 'navigation'] });
```

---

## 🔄 CI/CD 配置

### GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-convex:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - run: npx convex deploy --token ${{ secrets.CONVEX_DEPLOY_KEY }}

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: cd apps/client-rn && npm install
      - run: cd apps/client-rn && npx react-native build-android --mode=release
      - uses: actions/upload-artifact@v3
        with:
          name: android-apk
          path: apps/client-rn/android/app/build/outputs/apk/release/*.apk
```

---

## 🧪 部署后测试

### 1. 功能测试

使用测试清单验证所有功能：

- [ ] 用户登录
- [ ] 创建会话
- [ ] 卡片推荐
- [ ] 消息发送
- [ ] 图片上传
- [ ] 语音合成
- [ ] 离线模式

### 2. 性能测试

```bash
# 使用 Lighthouse 测试 Web 版本
npx lighthouse https://aacesstalk.com --view

# 测试 API 响应时间
curl -w "@curl-format.txt" -o /dev/null -s https://api.aacesstalk.com/api/v1/ping
```

### 3. 安全测试

```bash
# 检查 HTTPS 证书
openssl s_client -connect aacesstalk.com:443 -servername aacesstalk.com

# 检查 CORS 配置
curl -I -H "Origin: https://example.com" https://api.aacesstalk.com/api/v1/ping
```

---

## 📝 版本管理

### 语义化版本

- `MAJOR.MINOR.PATCH`
- MAJOR：不兼容的 API 变更
- MINOR：向后兼容的功能新增
- PATCH：向后兼容的问题修复

### 发布流程

1. 更新版本号
   ```bash
   npm version patch  # 或 minor, major
   ```

2. 创建 Git tag
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

3. 部署到生产
   ```bash
   npx convex deploy
   npx react-native build-android --mode=release
   ```

---

## 🆘 回滚计划

### Convex 回滚

```bash
# 查看部署历史
npx convex deploy list

# 回滚到特定版本
npx convex deploy --version <version-id>
```

### 应用回滚

```bash
# 保留上一个版本的 APK/AAB
# 在应用商店中回滚到上一个版本
```

---

## 📞 支持和联系

如有问题，请联系：
- 技术支持：support@aacesstalk.com
- 紧急联系：+1-XXX-XXX-XXXX

---

*最后更新：2026-01-14*