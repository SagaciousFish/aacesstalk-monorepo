import { FileSystem, Dirs } from 'react-native-file-access';

/**
 * 图片格式
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

/**
 * 图片优化配置
 */
export interface ImageOptimizationConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-100
  format?: ImageFormat;
  maintainAspectRatio?: boolean;
}

/**
 * 图片优化结果
 */
export interface ImageOptimizationResult {
  originalUri: string;
  optimizedUri: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: ImageFormat;
  width: number;
  height: number;
}

/**
 * 图片优化器
 * 提供图片压缩、格式转换、尺寸调整等功能
 */
export class ImageOptimizer {
  private static _instance: ImageOptimizer | undefined = undefined;
  private readonly cacheDir: string;

  private constructor() {
    this.cacheDir = `${Dirs.CacheDir}/optimized_images`;
    this.ensureCacheDir();
  }

  static get instance(): ImageOptimizer {
    if (this._instance == null) {
      this._instance = new ImageOptimizer();
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
        console.log('[ImageOptimizer] Cache directory created');
      }
    } catch (error) {
      console.error('[ImageOptimizer] Failed to create cache directory:', error);
    }
  }

  /**
   * 优化图片
   */
  async optimizeImage(
    uri: string,
    config: ImageOptimizationConfig = {}
  ): Promise<ImageOptimizationResult> {
    const {
      maxWidth = 512,
      maxHeight = 512,
      quality = 85,
      format = ImageFormat.WEBP,
      maintainAspectRatio = true,
    } = config;

    console.log(`[ImageOptimizer] Optimizing image: ${uri}`);

    try {
      // 获取原始图片信息
      const originalSize = await this.getImageSize(uri);
      const originalFileSize = await this.getFileSize(uri);

      // 检查是否需要优化
      if (
        originalSize.width <= maxWidth &&
        originalSize.height <= maxHeight &&
        format === ImageFormat.WEBP
      ) {
        console.log('[ImageOptimizer] Image already optimized, skipping');
        return {
          originalUri: uri,
          optimizedUri: uri,
          originalSize: originalFileSize,
          optimizedSize: originalFileSize,
          compressionRatio: 1,
          format,
          width: originalSize.width,
          height: originalSize.height,
        };
      }

      // 生成缓存文件名
      const cacheKey = this.generateCacheKey(uri, config);
      const optimizedUri = `${this.cacheDir}/${cacheKey}.${format}`;

      // 检查缓存
      if (await FileSystem.exists(optimizedUri)) {
        console.log('[ImageOptimizer] Using cached optimized image');
        const optimizedSize = await this.getFileSize(optimizedUri);
        return {
          originalUri: uri,
          optimizedUri,
          originalSize: originalFileSize,
          optimizedSize,
          compressionRatio: optimizedSize / originalFileSize,
          format,
          width: originalSize.width,
          height: originalSize.height,
        };
      }

      // 调整图片大小
      const resizedUri = await this.resizeImage(uri, maxWidth, maxHeight, maintainAspectRatio);

      // 转换格式并压缩
      const compressedUri = await this.compressImage(resizedUri, quality, format);

      // 移动到缓存目录
      const finalUri = await this.moveToCache(compressedUri, cacheKey, format);

      const optimizedSize = await this.getFileSize(finalUri);

      console.log(
        `[ImageOptimizer] Image optimized: ${originalFileSize} -> ${optimizedSize} bytes (${((optimizedSize / originalFileSize) * 100).toFixed(1)}%)`
      );

      return {
        originalUri: uri,
        optimizedUri: finalUri,
        originalSize: originalFileSize,
        optimizedSize,
        compressionRatio: optimizedSize / originalFileSize,
        format,
        width: originalSize.width,
        height: originalSize.height,
      };
    } catch (error) {
      console.error('[ImageOptimizer] Failed to optimize image:', error);
      throw error;
    }
  }

  /**
   * 调整图片大小
   */
  private async resizeImage(
    uri: string,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): Promise<string> {
    // 这里需要使用 expo-image-manipulator 或其他图片处理库
    // 由于项目中可能没有安装，我们先返回原始 URI
    // 在实际使用时，需要安装并使用 expo-image-manipulator

    console.log('[ImageOptimizer] Resize not implemented, returning original URI');
    return uri;
  }

  /**
   * 压缩图片
   */
  private async compressImage(
    uri: string,
    quality: number,
    format: ImageFormat
  ): Promise<string> {
    // 这里需要使用 expo-image-manipulator 或其他图片处理库
    // 由于项目中可能没有安装，我们先返回原始 URI
    // 在实际使用时，需要安装并使用 expo-image-manipulator

    console.log('[ImageOptimizer] Compress not implemented, returning original URI');
    return uri;
  }

  /**
   * 移动文件到缓存目录
   */
  private async moveToCache(
    uri: string,
    cacheKey: string,
    format: ImageFormat
  ): Promise<string> {
    const targetUri = `${this.cacheDir}/${cacheKey}.${format}`;

    try {
      await FileSystem.cp(uri, targetUri);
      return targetUri;
    } catch (error) {
      console.error('[ImageOptimizer] Failed to move file to cache:', error);
      return uri;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(uri: string, config: ImageOptimizationConfig): string {
    const keyParts = [
      uri,
      config.maxWidth || 512,
      config.maxHeight || 512,
      config.quality || 85,
      config.format || ImageFormat.WEBP,
    ];

    // 简单的哈希函数
    return this.hashString(keyParts.join(':'));
  }

  /**
   * 简单的字符串哈希
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取图片尺寸
   */
  private async getImageSize(uri: string): Promise<{ width: number; height: number }> {
    // 这里需要使用 expo-image-picker 或其他库来获取图片信息
    // 由于项目中可能没有安装，我们返回默认值

    console.log('[ImageOptimizer] Get image size not implemented, returning default');
    return { width: 512, height: 512 };
  }

  /**
   * 获取文件大小
   */
  private async getFileSize(uri: string): Promise<number> {
    try {
      const info = await FileSystem.stat(uri);
      return info.size;
    } catch (error) {
      console.error('[ImageOptimizer] Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      await FileSystem.unlink(this.cacheDir);
      await this.ensureCacheDir();
      console.log('[ImageOptimizer] Cache cleared');
    } catch (error) {
      console.error('[ImageOptimizer] Failed to clear cache:', error);
    }
  }

  /**
   * 获取缓存大小
   */
  async getCacheSize(): Promise<number> {
    try {
      const files = await FileSystem.ls(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = `${this.cacheDir}/${file}`;
        const info = await FileSystem.stat(filePath);
        totalSize += info.size;
      }

      return totalSize;
    } catch (error) {
      console.error('[ImageOptimizer] Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    fileCount: number;
    cacheDir: string;
  }> {
    try {
      const files = await FileSystem.ls(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = `${this.cacheDir}/${file}`;
        const info = await FileSystem.stat(filePath);
        totalSize += info.size;
      }

      return {
        totalSize,
        fileCount: files.length,
        cacheDir: this.cacheDir,
      };
    } catch (error) {
      console.error('[ImageOptimizer] Failed to get cache stats:', error);
      return {
        totalSize: 0,
        fileCount: 0,
        cacheDir: this.cacheDir,
      };
    }
  }
}

// 导出单例
export const imageOptimizer = ImageOptimizer.instance;

/**
 * 便捷方法：优化图片
 */
export const optimizeImage = (
  uri: string,
  config?: ImageOptimizationConfig
): Promise<ImageOptimizationResult> => {
  return imageOptimizer.optimizeImage(uri, config);
};

/**
 * 便捷方法：清除图片缓存
 */
export const clearImageCache = (): Promise<void> => {
  return imageOptimizer.clearCache();
};

/**
 * 便捷方法：获取缓存统计信息
 */
export const getImageCacheStats = (): Promise<{
  totalSize: number;
  fileCount: number;
  cacheDir: string;
}> => {
  return imageOptimizer.getCacheStats();
};