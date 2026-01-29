import { CardInfo, Http } from '@aacesstalk/libs/ts-core';
import { Dirs, FileSystem } from 'react-native-file-access';
import { ManagedFetchResult } from 'react-native-file-access/lib/typescript/types';
import SoundPlayer from 'react-native-sound-player';

/**
 * 语音合成缓存项
 */
export interface VoiceCacheItem {
  cardId: string;
  recommendationId: string;
  text: string;
  locale: string;
  filePath: string;
  fileSize: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * 语音合成结果
 */
export interface VoiceSynthesisResult {
  filePath: string;
  fromCache: boolean;
  fileSize: number;
  duration?: number;
}

/**
 * 语音合成缓存管理器
 * 提供语音合成的缓存、预加载、清理等功能
 */
export class VoiceCacheManager {
  private static _instance: VoiceCacheManager | undefined = undefined;
  private readonly cacheDir: string;
  private readonly cacheIndex: Map<string, VoiceCacheItem>;
  private readonly fileFetchTaskMap: Map<string, ManagedFetchResult>;
  private readonly MAX_CACHE_SIZE: number = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CACHE_ITEMS: number = 100;
  private readonly CACHE_TTL: number = 7 * 24 * 60 * 60 * 1000; // 7 天

  private constructor() {
    this.cacheDir = `${Dirs.CacheDir}/voiceover`;
    this.cacheIndex = new Map();
    this.fileFetchTaskMap = new Map();
    this.ensureCacheDir();
    this.loadCacheIndex();
  }

  static get instance(): VoiceCacheManager {
    if (this._instance == null) {
      this._instance = new VoiceCacheManager();
    }
    return this._instance;
  }

  /**
   * 确保缓存目录存在
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      const exists = await FileSystem.exists(this.cacheDir);
      if (!exists) {
        await FileSystem.mkdir(this.cacheDir);
        console.log('[VoiceCacheManager] Cache directory created');
      }
    } catch (error) {
      console.error('[VoiceCacheManager] Failed to create cache directory:', error);
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(cardId: string, recommendationId: string, text: string, locale: string): string {
    return `${cardId}_${recommendationId}_${locale}`;
  }

  /**
   * 生成文件名
   */
  private generateFileName(cardId: string, recommendationId: string, locale: string): string {
    return `voiceover_${cardId}_${recommendationId}_${locale}.mp3`;
  }

  /**
   * 获取或合成语音
   */
  async getVoiceOver(
    cardInfo: CardInfo,
    text: string,
    locale: string,
    authToken: string
  ): Promise<VoiceSynthesisResult> {
    const cacheKey = this.generateCacheKey(cardInfo.id, cardInfo.recommendation_id, text, locale);
    const fileName = this.generateFileName(cardInfo.id, cardInfo.recommendation_id, locale);
    const filePath = `${this.cacheDir}/${fileName}`;

    // 检查缓存
    if (this.cacheIndex.has(cacheKey)) {
      const cacheItem = this.cacheIndex.get(cacheKey)!;

      // 检查文件是否存在
      if (await FileSystem.exists(filePath)) {
        // 更新访问信息
        cacheItem.lastAccessedAt = Date.now();
        cacheItem.accessCount++;
        await this.saveCacheIndex();

        console.log(`[VoiceCacheManager] Using cached voiceover: ${cacheKey}`);
        return {
          filePath,
          fromCache: true,
          fileSize: cacheItem.fileSize,
        };
      } else {
        // 文件不存在，从索引中移除
        this.cacheIndex.delete(cacheKey);
        await this.saveCacheIndex();
      }
    }

    // 下载语音文件
    console.log(`[VoiceCacheManager] Downloading voiceover: ${cacheKey}`);
    const result = await this.downloadVoiceOver(cardInfo, text, locale, authToken, filePath);

    // 添加到缓存
    const fileSize = await this.getFileSize(filePath);
    const cacheItem: VoiceCacheItem = {
      cardId: cardInfo.id,
      recommendationId: cardInfo.recommendation_id,
      text,
      locale,
      filePath,
      fileSize,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
    };

    this.cacheIndex.set(cacheKey, cacheItem);
    await this.saveCacheIndex();

    // 检查缓存大小，如果超过限制则清理
    await this.checkAndCleanCache();

    return {
      filePath,
      fromCache: false,
      fileSize,
    };
  }

  /**
   * 下载语音文件
   */
  private async downloadVoiceOver(
    cardInfo: CardInfo,
    text: string,
    locale: string,
    authToken: string,
    filePath: string
  ): Promise<void> {
    const headers = {
      ...(await Http.getSignedInHeaders(authToken)),
      'Content-Type': 'audio/mpeg',
    };

    const cacheKey = this.generateCacheKey(cardInfo.id, cardInfo.recommendation_id, text, locale);

    const task = FileSystem.fetchManaged(
      `${Http.axios.defaults.baseURL}${Http.ENDPOINT_DYAD_MEDIA_VOICEOVER}?card_id=${cardInfo.id}&recommendation_id=${cardInfo.recommendation_id}`,
      {
        headers,
        method: 'GET',
        path: filePath,
      }
    );

    this.fileFetchTaskMap.set(cacheKey, task);

    try {
      const result = await task.result;

      if (!result.ok) {
        throw new Error(`Failed to download voiceover: ${result.statusText}`);
      }

      console.log(`[VoiceCacheManager] Voiceover downloaded successfully: ${cacheKey}`);
    } finally {
      this.fileFetchTaskMap.delete(cacheKey);
    }
  }

  /**
   * 预加载语音合成
   */
  async preloadVoiceOver(
    cardInfo: CardInfo,
    text: string,
    locale: string,
    authToken: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(cardInfo.id, cardInfo.recommendation_id, text, locale);

    // 如果已经在缓存中，跳过
    if (this.cacheIndex.has(cacheKey)) {
      return;
    }

    try {
      await this.getVoiceOver(cardInfo, text, locale, authToken);
      console.log(`[VoiceCacheManager] Preloaded voiceover: ${cacheKey}`);
    } catch (error) {
      console.error(`[VoiceCacheManager] Failed to preload voiceover: ${cacheKey}`, error);
    }
  }

  /**
   * 批量预加载语音合成
   */
  async preloadVoiceOverBatch(
    cards: Array<{ cardInfo: CardInfo; text: string; locale: string }>,
    authToken: string,
    concurrency: number = 3
  ): Promise<void> {
    console.log(`[VoiceCacheManager] Preloading ${cards.length} voiceovers with concurrency ${concurrency}`);

    for (let i = 0; i < cards.length; i += concurrency) {
      const batch = cards.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(({ cardInfo, text, locale }) =>
          this.preloadVoiceOver(cardInfo, text, locale, authToken)
        )
      );
    }

    console.log('[VoiceCacheManager] Batch preload completed');
  }

  /**
   * 取消下载任务
   */
  async cancelDownload(cardInfo: CardInfo, text: string, locale: string): Promise<void> {
    const cacheKey = this.generateCacheKey(cardInfo.id, cardInfo.recommendation_id, text, locale);
    const task = this.fileFetchTaskMap.get(cacheKey);

    if (task) {
      await task.cancel();
      this.fileFetchTaskMap.delete(cacheKey);
      console.log(`[VoiceCacheManager] Cancelled download: ${cacheKey}`);
    }
  }

  /**
   * 取消所有下载任务
   */
  async cancelAllDownloads(): Promise<void> {
    const tasks = Array.from(this.fileFetchTaskMap.values());
    await Promise.allSettled(tasks.map((t) => t.cancel()));
    this.fileFetchTaskMap.clear();
    console.log('[VoiceCacheManager] Cancelled all downloads');
  }

  /**
   * 清理过期缓存
   */
  private async cleanExpiredCache(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cacheIndex.entries()) {
      if (now - item.createdAt > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.removeCacheItem(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[VoiceCacheManager] Cleaned ${expiredKeys.length} expired cache items`);
    }
  }

  /**
   * 清理缓存以释放空间
   */
  private async cleanCacheBySize(): Promise<void> {
    const totalSize = await this.getTotalCacheSize();

    if (totalSize <= this.MAX_CACHE_SIZE) {
      return;
    }

    console.log('[VoiceCacheManager] Cache size exceeded, cleaning...');

    // 按访问频率和最后访问时间排序
    const sortedItems = Array.from(this.cacheIndex.entries()).sort((a, b) => {
      const scoreA = a[1].accessCount / (Date.now() - a[1].lastAccessedAt);
      const scoreB = b[1].accessCount / (Date.now() - b[1].lastAccessedAt);
      return scoreA - scoreB;
    });

    let removedCount = 0;
    for (const [key] of sortedItems) {
      await this.removeCacheItem(key);
      removedCount++;

      const newSize = await this.getTotalCacheSize();
      if (newSize <= this.MAX_CACHE_SIZE * 0.8) {
        break;
      }
    }

    console.log(`[VoiceCacheManager] Removed ${removedCount} cache items to free space`);
  }

  /**
   * 检查并清理缓存
   */
  private async checkAndCleanCache(): Promise<void> {
    await this.cleanExpiredCache();
    await this.cleanCacheBySize();
  }

  /**
   * 移除缓存项
   */
  private async removeCacheItem(key: string): Promise<void> {
    const item = this.cacheIndex.get(key);

    if (item) {
      try {
        await FileSystem.unlink(item.filePath);
      } catch (error) {
        console.error(`[VoiceCacheManager] Failed to delete file: ${item.filePath}`, error);
      }

      this.cacheIndex.delete(key);
      await this.saveCacheIndex();
    }
  }

  /**
   * 获取缓存总大小
   */
  private async getTotalCacheSize(): Promise<number> {
    let totalSize = 0;

    for (const item of this.cacheIndex.values()) {
      totalSize += item.fileSize;
    }

    return totalSize;
  }

  /**
   * 获取文件大小
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const info = await FileSystem.stat(filePath);
      return info.size;
    } catch (error) {
      console.error('[VoiceCacheManager] Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * 保存缓存索引
   */
  private async saveCacheIndex(): Promise<void> {
    try {
      const indexFile = `${this.cacheDir}/cache_index.json`;
      const indexData = Array.from(this.cacheIndex.entries());
      await FileSystem.writeFile(indexFile, JSON.stringify(indexData));
    } catch (error) {
      console.error('[VoiceCacheManager] Failed to save cache index:', error);
    }
  }

  /**
   * 加载缓存索引
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const indexFile = `${this.cacheDir}/cache_index.json`;
      const exists = await FileSystem.exists(indexFile);

      if (exists) {
        const content = await FileSystem.readFile(indexFile);
        const indexData = JSON.parse(content) as Array<[string, VoiceCacheItem]>;

        for (const [key, item] of indexData) {
          // 检查文件是否存在
          if (await FileSystem.exists(item.filePath)) {
            this.cacheIndex.set(key, item);
          }
        }

        console.log(`[VoiceCacheManager] Loaded ${this.cacheIndex.size} cache items`);
      }
    } catch (error) {
      console.error('[VoiceCacheManager] Failed to load cache index:', error);
    }
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    try {
      await FileSystem.unlink(this.cacheDir);
      await this.ensureCacheDir();
      this.cacheIndex.clear();
      this.fileFetchTaskMap.clear();
      console.log('[VoiceCacheManager] Cache cleared');
    } catch (error) {
      console.error('[VoiceCacheManager] Failed to clear cache:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    itemCount: number;
    totalAccessCount: number;
    oldestItem: VoiceCacheItem | null;
    newestItem: VoiceCacheItem | null;
  }> {
    let totalSize = 0;
    let totalAccessCount = 0;
    let oldestItem: VoiceCacheItem | null = null;
    let newestItem: VoiceCacheItem | null = null;

    for (const item of this.cacheIndex.values()) {
      totalSize += item.fileSize;
      totalAccessCount += item.accessCount;

      if (!oldestItem || item.createdAt < oldestItem.createdAt) {
        oldestItem = item;
      }

      if (!newestItem || item.createdAt > newestItem.createdAt) {
        newestItem = item;
      }
    }

    return {
      totalSize,
      itemCount: this.cacheIndex.size,
      totalAccessCount,
      oldestItem,
      newestItem,
    };
  }
}

// 导出单例
export const voiceCacheManager = VoiceCacheManager.instance;

/**
 * 便捷方法：获取语音合成
 */
export const getVoiceOver = (
  cardInfo: CardInfo,
  text: string,
  locale: string,
  authToken: string
): Promise<VoiceSynthesisResult> => {
  return voiceCacheManager.getVoiceOver(cardInfo, text, locale, authToken);
};

/**
 * 便捷方法：预加载语音合成
 */
export const preloadVoiceOver = (
  cardInfo: CardInfo,
  text: string,
  locale: string,
  authToken: string
): Promise<void> => {
  return voiceCacheManager.preloadVoiceOver(cardInfo, text, locale, authToken);
};

/**
 * 便捷方法：清除语音缓存
 */
export const clearVoiceCache = (): Promise<void> => {
  return voiceCacheManager.clearCache();
};

/**
 * 便捷方法：获取缓存统计信息
 */
export const getVoiceCacheStats = (): Promise<{
  totalSize: number;
  itemCount: number;
  totalAccessCount: number;
  oldestItem: VoiceCacheItem | null;
  newestItem: VoiceCacheItem | null;
}> => {
  return voiceCacheManager.getCacheStats();
};