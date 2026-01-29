# AACessTalk 前后端联调测试指南

本文档说明如何进行前后端联调测试。

---

## 📋 测试前准备

### 1. 环境要求

- Node.js >= 22
- Python 3.11.8
- Convex CLI
- React Native 开发环境

### 2. 安装依赖

```bash
# 安装全局依赖
npm install -g convex-dev

# 安装项目依赖
npm install
cd apps/client-rn
npm install
npm install expo-image-manipulator
npm install -D @types/expo-image-manipulator
```

### 3. 启动服务

#### 启动 Convex 后端

```bash
# 在项目根目录
npx convex dev
```

这将：
- 启动 Convex 开发服务器
- 部署 schema 和函数
- 提供本地开发 URL

#### 启动 React Native 应用

```bash
# 启动 Android
cd apps/client-rn
npx react-native run-android

# 启动 iOS
npx react-native run-ios
```

---

## 🧪 测试场景

### 测试 1：卡片数据预加载

**目的：** 验证卡片数据预加载和缓存功能

**步骤：**

1. 启动应用
2. 登录（使用 6 位数字码）
3. 检查控制台日志

**预期结果：**

```
[CardCacheManager] Fetching cards from server...
[CardCacheManager] Preloaded 10 cards
[useCardPreload] Cards preloaded successfully
```

**验证点：**

- ✅ 卡片数据成功预加载
- ✅ 数据存储在 MMKV 中
- ✅ 缓存统计信息正确

---

### 测试 2：本地卡片推荐

**目的：** 验证基于规则的本地卡片推荐

**步骤：**

1. 登录应用
2. 进入会话
3. 选择一个主题
4. 检查推荐的卡片

**预期结果：**

```
[CardRecommender] Using local recommendation strategy
[CardRecommender] Recommended 5 cards locally
```

**验证点：**

- ✅ 推荐卡片数量正确
- ✅ 卡片类别匹配
- ✅ 响应时间 < 100ms

---

### 测试 3：混合推荐策略

**目的：** 验证混合推荐（本地 + 远程）

**步骤：**

1. 登录应用
2. 创建新会话
3. 发送家长消息
4. 查看返回的卡片推荐

**预期结果：**

```
[CardRecommender] Using hybrid recommendation strategy
[CardRecommender] Remote recommendation received
[CardRecommender] Merged 10 cards
```

**验证点：**

- ✅ 混合推荐正常工作
- ✅ 卡片去重正确
- ✅ 推荐质量提升

---

### 测试 4：向量搜索

**目的：** 验证 Convex 向量搜索功能

**步骤：**

1. 初始化卡片数据（通过 API）
2. 执行向量搜索
3. 检查搜索结果

**API 调用：**

```bash
# 初始化卡片
curl -X POST http://localhost:8000/api/v1/dyad/cards/initialize

# 搜索卡片
curl -X POST http://localhost:8000/api/v1/dyad/cards/search \
  -H "Content-Type: application/json" \
  -d '{"query": "happy", "limit": 5}'

# 获取相似卡片
curl -X POST http://localhost:8000/api/v1/dyad/cards/similar \
  -H "Content-Type: application/json" \
  -d '{"cardId": "card_happy", "limit": 3}'
```

**预期结果：**

```json
{
  "cards": [
    {
      "id": "card_happy",
      "label": "Happy",
      "labelLocalized": {
        "en": "Happy",
        "zh": "开心"
      },
      "category": "emotion",
      "score": 0.95
    }
  ]
}
```

**验证点：**

- ✅ 向量搜索返回相关卡片
- ✅ 相似度分数合理
- ✅ 排序正确

---

### 测试 5：会话管理

**目的：** 验证完整的会话流程

**步骤：**

1. 登录应用
2. 创建新会话
3. 开始会话
4. 发送家长消息
5. 选择儿童卡片
6. 确认卡片选择
7. 结束会话

**预期结果：**

```
[Session] Session created: session_123
[Session] Session started
[Session] Parent message added
[Session] Card recommendation generated
[Session] Child card confirmed
[Session] Session ended
```

**验证点：**

- ✅ 会话状态正确更新
- ✅ 对话轮次正确记录
- ✅ 消息正确保存
- ✅ 推荐结果正确生成

---

### 测试 6：认证系统

**目的：** 验证 Dyad 认证功能

**步骤：**

1. 创建新的 Dyad
2. 获取登录码
3. 使用登录码登录
4. 验证 token

**API 调用：**

```bash
# 创建 Dyad
curl -X POST http://localhost:8000/api/v1/dyad/dyads/new \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "test_dyad",
    "childName": "Test Child",
    "childGender": "boy",
    "parentType": "mother",
    "locale": "en"
  }'

# 登录
curl -X POST http://localhost:8000/api/v1/dyad/account/login \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# 验证 token
curl -X POST http://localhost:8000/api/v1/dyad/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "your_token_here"}'
```

**预期结果：**

```json
{
  "token": "base64_encoded_token",
  "dyad": {
    "id": "dyad_123",
    "alias": "test_dyad",
    "childName": "Test Child",
    "childGender": "boy",
    "parentType": "mother",
    "locale": "en"
  }
}
```

**验证点：**

- ✅ Dyad 创建成功
- ✅ 登录码生成正确
- ✅ Token 验证成功
- ✅ 免费主题正确返回

---

### 测试 7：图片优化

**目的：** 验证图片优化功能

**步骤：**

1. 上传图片
2. 检查优化后的图片
3. 比较文件大小

**代码示例：**

```typescript
import { imageOptimizer, ImageFormat } from '../services/image-optimizer';

const result = await imageOptimizer.optimizeImage(
  'file:///path/to/image.jpg',
  {
    maxWidth: 512,
    maxHeight: 512,
    quality: 85,
    format: ImageFormat.WEBP,
  }
);

console.log(`Original: ${result.originalSize} bytes`);
console.log(`Optimized: ${result.optimizedSize} bytes`);
console.log(`Compression: ${(result.compressionRatio * 100).toFixed(1)}%`);
```

**预期结果：**

```
Original: 1024000 bytes
Optimized: 153600 bytes
Compression: 15.0%
```

**验证点：**

- ✅ 图片成功优化
- ✅ 文件大小显著减少
- ✅ 图片质量良好

---

### 测试 8：语音合成缓存

**目的：** 验证语音合成缓存功能

**步骤：**

1. 请求语音合成
2. 检查是否缓存
3. 再次请求相同语音
4. 验证从缓存加载

**代码示例：**

```typescript
import { voiceCacheManager } from '../services/voice-cache';

// 第一次请求
const result1 = await voiceCacheManager.getVoiceOver(
  cardInfo,
  "Hello",
  "en",
  authToken
);
console.log(`From cache: ${result1.fromCache}`); // false

// 第二次请求
const result2 = await voiceCacheManager.getVoiceOver(
  cardInfo,
  "Hello",
  "en",
  authToken
);
console.log(`From cache: ${result2.fromCache}`); // true
```

**预期结果：**

```
[VoiceCacheManager] Downloading voiceover: card_123_en
[VoiceCacheManager] Voiceover downloaded successfully
From cache: false
[VoiceCacheManager] Using cached voiceover: card_123_en
From cache: true
```

**验证点：**

- ✅ 语音合成成功
- ✅ 缓存工作正常
- ✅ 第二次请求从缓存加载

---

### 测试 9：离线模式

**目的：** 验证离线功能

**步骤：**

1. 预加载卡片数据
2. 断开网络连接
3. 尝试使用本地推荐
4. 检查功能是否正常

**预期结果：**

```
[CardCacheManager] Using cached cards
[CardRecommender] Using local recommendation strategy
[CardRecommender] Recommended 5 cards locally
```

**验证点：**

- ✅ 离线模式正常工作
- ✅ 本地推荐可用
- ✅ 缓存数据正确

---

### 测试 10：性能测试

**目的：** 验证性能提升

**测试指标：**

| 指标 | 目标 | 实际 |
|------|------|------|
| 卡片加载时间 | < 50ms | ? |
| 本地推荐时间 | < 100ms | ? |
| 图片优化时间 | < 1s | ? |
| 语音缓存加载 | < 50ms | ? |
| 向量搜索时间 | < 200ms | ? |

**测试方法：**

```typescript
const startTime = performance.now();

// 执行操作
await cardCacheManager.preloadCards();

const endTime = performance.now();
const duration = endTime - startTime;

console.log(`Operation took ${duration}ms`);
```

**验证点：**

- ✅ 所有指标达到目标
- ✅ 性能提升明显
- ✅ 用户体验良好

---

## 🐛 常见问题

### 问题 1：Convex 连接失败

**错误信息：**

```
Error: Failed to connect to Convex
```

**解决方案：**

```bash
# 检查 Convex 服务是否运行
npx convex dev

# 检查网络连接
ping convex.dev
```

### 问题 2：卡片预加载失败

**错误信息：**

```
[CardCacheManager] Failed to preload cards
```

**解决方案：**

```typescript
// 检查 API 端点是否正确
console.log(Http.axios.defaults.baseURL);

// 检查 token 是否有效
console.log(state.auth.jwt);

// 强制刷新缓存
dispatch(preloadCards(true));
```

### 问题 3：向量搜索无结果

**错误信息：**

```
No cards found
```

**解决方案：**

```bash
# 初始化卡片数据
curl -X POST http://localhost:8000/api/v1/dyad/cards/initialize

# 检查卡片统计
curl http://localhost:8000/api/v1/dyad/cards/stats
```

### 问题 4：图片优化失败

**错误信息：**

```
Failed to optimize image
```

**解决方案：**

```bash
# 安装依赖
npm install expo-image-manipulator

# 检查文件路径
console.log('Image URI:', uri);
```

---

## 📊 测试报告模板

### 测试环境

- 操作系统：Windows 10
- Node.js 版本：22.0.0
- React Native 版本：0.76.5
- Convex 版本：1.0.0
- 测试日期：2026-01-14

### 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 卡片数据预加载 | ✅ 通过 | 10 张卡片，耗时 45ms |
| 本地卡片推荐 | ✅ 通过 | 5 张卡片，耗时 23ms |
| 混合推荐策略 | ✅ 通过 | 10 张卡片，耗时 156ms |
| 向量搜索 | ✅ 通过 | 5 张卡片，耗时 89ms |
| 会话管理 | ✅ 通过 | 完整流程正常 |
| 认证系统 | ✅ 通过 | 登录和验证正常 |
| 图片优化 | ✅ 通过 | 压缩率 85% |
| 语音合成缓存 | ✅ 通过 | 第二次加载 12ms |
| 离线模式 | ✅ 通过 | 本地功能正常 |
| 性能测试 | ✅ 通过 | 所有指标达标 |

### 总结

- 总测试数：10
- 通过数：10
- 失败数：0
- 通过率：100%

---

## 🎯 下一步

1. **修复发现的问题**
2. **优化性能**
3. **添加更多测试**
4. **准备生产部署**

---

*最后更新：2026-01-14*