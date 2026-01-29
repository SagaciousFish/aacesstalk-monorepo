# 前端优化服务使用说明

本文档说明如何使用新添加的前端优化服务。

## 已完成的功能

### 1. 卡片数据预加载和缓存 (`card-cache.ts`)

自动预加载所有卡片数据到本地，减少网络请求。

**使用方法：**

```typescript
import { cardCacheManager } from '../services/card-cache';

// 预加载卡片（在应用启动时自动调用）
await cardCacheManager.preloadCards();

// 根据上下文推荐卡片
const recommendedCards = cardCacheManager.recommendCards({
  category: CardCategory.Emotion,
  parentType: ParentType.Mother,
  childGender: ChildGender.Boy,
  locale: UserLocale.English,
  keywords: ['happy', 'excited'],
  limit: 10,
});

// 获取缓存统计信息
const stats = cardCacheManager.getCacheStats();
console.log(`Total cards: ${stats.totalCards}`);
console.log(`Cache age: ${stats.cacheAge}ms`);
```

**Redux 集成：**

```typescript
import { useDispatch, useSelector } from '../redux/hooks';
import { preloadCards, getCacheStats } from '../redux/slices/cardCacheSlice';

// 预加载卡片
dispatch(preloadCards(false));

// 获取缓存统计
dispatch(getCacheStats());

// 查看状态
const isPreloading = useSelector(state => state.cardCache.isPreloading);
const cards = useSelector(state => state.cardCache.cards);
```

### 2. 智能卡片推荐 (`card-recommender.ts`)

提供三种推荐策略：本地规则推荐、远程 AI 推荐、混合推荐。

**使用方法：**

```typescript
import { cardRecommender, RecommendationStrategy } from '../services/card-recommender';

// 混合推荐（默认）
const result = await cardRecommender.recommend({
  category: CardCategory.Emotion,
  parentType: ParentType.Mother,
  childGender: ChildGender.Boy,
  locale: UserLocale.English,
  sessionId: 'session-123',
  turnId: 'turn-456',
});

// 仅本地推荐
const localResult = await cardRecommender.recommend(context, RecommendationStrategy.LocalOnly);

// 仅远程推荐
const remoteResult = await cardRecommender.recommend(context, RecommendationStrategy.RemoteOnly);

console.log(`推荐策略: ${result.strategy}`);
console.log(`推荐卡片数: ${result.cards.length}`);
console.log(`来自缓存: ${result.fromCache}`);
```

**Redux 集成：**

```typescript
import { useDispatch, useSelector } from '../redux/hooks';
import { recommendCards, recommendCardsByCategory } from '../redux/slices/recommendationSlice';

// 推荐卡片
dispatch(recommendCards({
  context: {
    category: CardCategory.Emotion,
    sessionId: 'session-123',
  },
}));

// 便捷方法：按类别推荐
dispatch(recommendCardsByCategory(CardCategory.Emotion, 'session-123'));

// 查看状态
const currentRecommendations = useSelector(state => state.recommendation.currentRecommendations);
const isRecommending = useSelector(state => state.recommendation.isRecommending);
```

### 3. 图片优化 (`image-optimizer.ts`)

提供图片压缩、格式转换、尺寸调整等功能。

**使用方法：**

```typescript
import { imageOptimizer, ImageFormat } from '../services/image-optimizer';

// 优化图片
const result = await imageOptimizer.optimizeImage('file:///path/to/image.jpg', {
  maxWidth: 512,
  maxHeight: 512,
  quality: 85,
  format: ImageFormat.WEBP,
  maintainAspectRatio: true,
});

console.log(`原始大小: ${result.originalSize} bytes`);
console.log(`优化后大小: ${result.optimizedSize} bytes`);
console.log(`压缩比: ${(result.compressionRatio * 100).toFixed(1)}%`);
console.log(`优化后 URI: ${result.optimizedUri}`);

// 清除缓存
await imageOptimizer.clearCache();

// 获取缓存统计
const stats = await imageOptimizer.getCacheStats();
console.log(`缓存大小: ${stats.totalSize} bytes`);
console.log(`文件数量: ${stats.fileCount}`);
```

**便捷方法：**

```typescript
import { optimizeImage, clearImageCache, getImageCacheStats } from '../services/image-optimizer';

// 优化图片
const result = await optimizeImage(uri, { maxWidth: 512, quality: 85 });

// 清除缓存
await clearImageCache();

// 获取统计
const stats = await getImageCacheStats();
```

## 需要安装的依赖

为了实现完整的图片优化功能，需要安装以下依赖：

```bash
cd apps/client-rn
npm install expo-image-manipulator
npm install -D @types/expo-image-manipulator
```

然后在 `image-optimizer.ts` 中更新 `resizeImage` 和 `compressImage` 方法：

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

private async resizeImage(
  uri: string,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio: boolean
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth, height: maxHeight } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

private async compressImage(
  uri: string,
  quality: number,
  format: ImageFormat
): Promise<string> {
  const saveFormat =
    format === ImageFormat.WEBP
      ? ImageManipulator.SaveFormat.WEBP
      : format === ImageFormat.PNG
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: quality / 100, format: saveFormat }
  );
  return result.uri;
}

private async getImageSize(uri: string): Promise<{ width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(uri, [], { compress: 1 });
  return { width: result.width, height: result.height };
}
```

## 性能优化建议

1. **卡片预加载**
   - 在用户登录后立即预加载
   - 使用 `useCardPreload` hook 自动处理
   - 缓存有效期设置为 24 小时

2. **卡片推荐**
   - 默认使用混合推荐策略
   - 推荐结果缓存 5 分钟
   - 网络不可用时自动回退到本地推荐

3. **图片优化**
   - 上传前自动优化图片
   - 使用 WebP 格式减少文件大小
   - 缓存优化后的图片避免重复处理

## 下一步

1. ✅ 卡片数据预加载和缓存
2. ✅ 基于规则的卡片推荐
3. ✅ 图片优化功能
4. ⏳ 语音合成缓存
5. ⏳ Convex 后端迁移

## 测试建议

1. 测试卡片预加载性能
2. 测试不同推荐策略的效果
3. 测试图片优化后的质量
4. 测试缓存机制的正确性
5. 测试离线模式下的功能