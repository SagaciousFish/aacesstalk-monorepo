import { CardInfo, CardCategory, ParentType, ChildGender, UserLocale, ChildCardRecommendationResult } from '@aacesstalk/libs/ts-core';
import { cardCacheManager, RecommendationContext } from './card-cache';
import { Http } from '@aacesstalk/libs/ts-core';

/**
 * 推荐策略
 */
export enum RecommendationStrategy {
  /** 仅使用前端规则推荐 */
  LocalOnly = 'local_only',
  /** 仅使用后端 AI 推荐 */
  RemoteOnly = 'remote_only',
  /** 混合推荐（前端规则 + 后端 AI） */
  Hybrid = 'hybrid',
}

/**
 * 推荐配置
 */
export interface RecommendationConfig {
  strategy: RecommendationStrategy;
  fallbackToLocal: boolean; // 如果远程推荐失败，是否回退到本地推荐
  cacheEnabled: boolean; // 是否启用推荐缓存
  cacheTTL: number; // 缓存有效期（毫秒）
}

/**
 * 推荐结果
 */
export interface RecommendationResult {
  cards: CardInfo[];
  strategy: RecommendationStrategy;
  fromCache: boolean;
  timestamp: number;
}

/**
 * 卡片推荐器
 * 提供多种推荐策略，包括本地规则推荐、远程 AI 推荐和混合推荐
 */
export class CardRecommender {
  private static _instance: CardRecommender | undefined = undefined;
  private readonly config: RecommendationConfig;
  private readonly recommendationCache: Map<string, { result: RecommendationResult; timestamp: number }>;

  private constructor(config?: Partial<RecommendationConfig>) {
    this.config = {
      strategy: RecommendationStrategy.Hybrid,
      fallbackToLocal: true,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 分钟缓存
      ...config,
    };
    this.recommendationCache = new Map();
  }

  static get instance(): CardRecommender {
    if (this._instance == null) {
      this._instance = new CardRecommender();
    }
    return this._instance;
  }

  /**
   * 推荐卡片
   */
  async recommend(
    context: RecommendationContext & { sessionId?: string; turnId?: string },
    strategy?: RecommendationStrategy
  ): Promise<RecommendationResult> {
    const effectiveStrategy = strategy || this.config.strategy;
    const cacheKey = this.generateCacheKey(context, effectiveStrategy);

    // 检查缓存
    if (this.config.cacheEnabled) {
      const cached = this.getCachedRecommendation(cacheKey);
      if (cached) {
        console.log('[CardRecommender] Using cached recommendation');
        return cached;
      }
    }

    let result: RecommendationResult;

    try {
      switch (effectiveStrategy) {
        case RecommendationStrategy.LocalOnly:
          result = await this.recommendLocal(context);
          break;

        case RecommendationStrategy.RemoteOnly:
          result = await this.recommendRemote(context);
          break;

        case RecommendationStrategy.Hybrid:
          result = await this.recommendHybrid(context);
          break;

        default:
          throw new Error(`Unknown recommendation strategy: ${effectiveStrategy}`);
      }

      // 缓存结果
      if (this.config.cacheEnabled) {
        this.cacheRecommendation(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('[CardRecommender] Recommendation failed:', error);

      // 如果远程推荐失败且启用了回退，使用本地推荐
      if (
        effectiveStrategy !== RecommendationStrategy.LocalOnly &&
        this.config.fallbackToLocal
      ) {
        console.log('[CardRecommender] Falling back to local recommendation');
        result = await this.recommendLocal(context);
        result.strategy = RecommendationStrategy.LocalOnly;
        return result;
      }

      throw error;
    }
  }

  /**
   * 本地规则推荐
   */
  private async recommendLocal(context: RecommendationContext): Promise<RecommendationResult> {
    console.log('[CardRecommender] Using local recommendation strategy');

    const cards = cardCacheManager.recommendCards(context);

    return {
      cards,
      strategy: RecommendationStrategy.LocalOnly,
      fromCache: false,
      timestamp: Date.now(),
    };
  }

  /**
   * 远程 AI 推荐
   */
  private async recommendRemote(
    context: RecommendationContext & { sessionId?: string; turnId?: string }
  ): Promise<RecommendationResult> {
    console.log('[CardRecommender] Using remote recommendation strategy');

    if (!context.sessionId) {
      throw new Error('sessionId is required for remote recommendation');
    }

    const response = await Http.post(
      `/api/v1/dyad/session/${context.sessionId}/message/child/refresh_cards`,
      null
    );

    const recommendation: ChildCardRecommendationResult = response.data;

    return {
      cards: recommendation.cards,
      strategy: RecommendationStrategy.RemoteOnly,
      fromCache: false,
      timestamp: Date.now(),
    };
  }

  /**
   * 混合推荐
   * 先使用本地规则推荐，如果有网络连接则请求 AI 推荐并合并结果
   */
  private async recommendHybrid(
    context: RecommendationContext & { sessionId?: string; turnId?: string }
  ): Promise<RecommendationResult> {
    console.log('[CardRecommender] Using hybrid recommendation strategy');

    // 先获取本地推荐
    const localResult = await this.recommendLocal(context);

    // 如果没有 sessionId，只返回本地推荐
    if (!context.sessionId) {
      return localResult;
    }

    try {
      // 尝试获取远程推荐
      const remoteResult = await this.recommendRemote(context);

      // 合并推荐结果
      const mergedCards = this.mergeRecommendations(localResult.cards, remoteResult.cards);

      return {
        cards: mergedCards,
        strategy: RecommendationStrategy.Hybrid,
        fromCache: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.log('[CardRecommender] Remote recommendation failed, using local only');
      return localResult;
    }
  }

  /**
   * 合并推荐结果
   * 优先保留远程推荐的卡片，去重后补充本地推荐的卡片
   */
  private mergeRecommendations(localCards: CardInfo[], remoteCards: CardInfo[]): CardInfo[] {
    const remoteCardIds = new Set(remoteCards.map(card => card.id));
    const mergedCards = [...remoteCards];

    // 添加本地推荐中不重复的卡片
    for (const card of localCards) {
      if (!remoteCardIds.has(card.id)) {
        mergedCards.push(card);
      }
    }

    // 限制返回数量
    return mergedCards.slice(0, 20);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    context: RecommendationContext,
    strategy: RecommendationStrategy
  ): string {
    const keyParts = [
      strategy,
      context.category || 'all',
      context.parentType || 'any',
      context.childGender || 'any',
      context.locale || 'any',
      context.keywords?.join(',') || '',
    ];

    return keyParts.join(':');
  }

  /**
   * 获取缓存的推荐
   */
  private getCachedRecommendation(cacheKey: string): RecommendationResult | null {
    const cached = this.recommendationCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.recommendationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * 缓存推荐结果
   */
  private cacheRecommendation(cacheKey: string, result: RecommendationResult): void {
    this.recommendationCache.set(cacheKey, { result, timestamp: Date.now() });

    // 限制缓存大小
    if (this.recommendationCache.size > 100) {
      const oldestKey = this.recommendationCache.keys().next().value;
      if (oldestKey) {
        this.recommendationCache.delete(oldestKey);
      }
    }
  }

  /**
   * 清除推荐缓存
   */
  clearCache(): void {
    this.recommendationCache.clear();
    console.log('[CardRecommender] Recommendation cache cleared');
  }

  /**
   * 获取推荐统计信息
   */
  getStats(): {
    cacheSize: number;
    config: RecommendationConfig;
  } {
    return {
      cacheSize: this.recommendationCache.size,
      config: { ...this.config },
    };
  }
}

// 导出单例
export const cardRecommender = CardRecommender.instance;