import { MMKV } from 'react-native-mmkv';
import { CardInfo, CardCategory, ParentType, ChildGender, UserLocale } from '@aacesstalk/libs/ts-core';
import { Http } from '@aacesstalk/libs/ts-core';

/**
 * 卡片缓存管理器
 * 负责预加载、缓存和提供卡片数据
 */
export class CardCacheManager {
  private static _instance: CardCacheManager | undefined = undefined;
  private readonly storage: MMKV;
  private readonly CACHE_KEY = 'cached_cards';
  private readonly CACHE_VERSION_KEY = 'cards_cache_version';
  private readonly CACHE_TIMESTAMP_KEY = 'cards_cache_timestamp';
  private readonly CURRENT_VERSION = '1.0.0';

  // 内存缓存，避免频繁读取 MMKV
  private memoryCache: Map<string, CardInfo[]> | null = null;

  private constructor() {
    this.storage = new MMKV({ id: 'card_cache' });
  }

  static get instance(): CardCacheManager {
    if (this._instance == null) {
      this._instance = new CardCacheManager();
    }
    return this._instance;
  }

  /**
   * 预加载所有卡片数据
   */
  async preloadCards(forceRefresh = false): Promise<CardInfo[]> {
    const cachedVersion = this.storage.getString(this.CACHE_VERSION_KEY);
    const cacheTimestamp = this.storage.getNumber(this.CACHE_TIMESTAMP_KEY);

    // 检查缓存是否有效（24小时内）
    const isCacheValid =
      !forceRefresh &&
      cachedVersion === this.CURRENT_VERSION &&
      cacheTimestamp &&
      Date.now() - cacheTimestamp < 24 * 60 * 60 * 1000;

    if (isCacheValid) {
      console.log('[CardCacheManager] Using cached cards');
      return this.getCachedCards();
    }

    console.log('[CardCacheManager] Fetching cards from server...');
    try {
      const response = await Http.get('/api/v1/dyad/data/cards');
      const cards: CardInfo[] = response.data;

      // 保存到缓存
      this.saveCardsToCache(cards);

      console.log(`[CardCacheManager] Preloaded ${cards.length} cards`);
      return cards;
    } catch (error) {
      console.error('[CardCacheManager] Failed to preload cards:', error);

      // 如果网络请求失败，尝试使用缓存
      const cachedCards = this.getCachedCards();
      if (cachedCards.length > 0) {
        console.log('[CardCacheManager] Using cached cards as fallback');
        return cachedCards;
      }

      throw error;
    }
  }

  /**
   * 从缓存获取卡片
   */
  getCachedCards(): CardInfo[] {
    if (this.memoryCache) {
      return Array.from(this.memoryCache.values()).flat();
    }

    const cachedData = this.storage.getString(this.CACHE_KEY);
    if (!cachedData) {
      return [];
    }

    try {
      const cards: CardInfo[] = JSON.parse(cachedData);
      this.memoryCache = new Map();
      cards.forEach(card => {
        const category = card.category;
        if (!this.memoryCache.has(category)) {
          this.memoryCache.set(category, []);
        }
        this.memoryCache.get(category)!.push(card);
      });
      return cards;
    } catch (error) {
      console.error('[CardCacheManager] Failed to parse cached cards:', error);
      return [];
    }
  }

  /**
   * 保存卡片到缓存
   */
  private saveCardsToCache(cards: CardInfo[]): void {
    try {
      const cardsJson = JSON.stringify(cards);
      this.storage.set(this.CACHE_KEY, cardsJson);
      this.storage.set(this.CACHE_VERSION_KEY, this.CURRENT_VERSION);
      this.storage.set(this.CACHE_TIMESTAMP_KEY, Date.now());

      // 更新内存缓存
      this.memoryCache = new Map();
      cards.forEach(card => {
        const category = card.category;
        if (!this.memoryCache.has(category)) {
          this.memoryCache.set(category, []);
        }
        this.memoryCache.get(category)!.push(card);
      });

      console.log('[CardCacheManager] Saved cards to cache');
    } catch (error) {
      console.error('[CardCacheManager] Failed to save cards to cache:', error);
    }
  }

  /**
   * 根据上下文推荐卡片（基于规则）
   * 这是前端本地推荐，不依赖后端 AI
   */
  recommendCards(context: RecommendationContext): CardInfo[] {
    const allCards = this.getCachedCards();
    let filteredCards = allCards;

    // 1. 按类别过滤
    if (context.category) {
      filteredCards = filteredCards.filter(card => card.category === context.category);
    }

    // 2. 按家长类型过滤（如果有个性化卡片）
    if (context.parentType) {
      // 这里可以添加更复杂的过滤逻辑
      // 例如：某些卡片可能更适合母亲或父亲
    }

    // 3. 按子女性别过滤（如果有个性化卡片）
    if (context.childGender) {
      // 这里可以添加更复杂的过滤逻辑
    }

    // 4. 按语言过滤
    if (context.locale) {
      // 优先选择本地化标签匹配的卡片
      const localeCards = filteredCards.filter(card =>
        card.label_localized && card.label_localized.length > 0
      );

      if (localeCards.length > 0) {
        filteredCards = localeCards;
      }
    }

    // 5. 按关键词过滤（如果有搜索词）
    if (context.keywords && context.keywords.length > 0) {
      filteredCards = filteredCards.filter(card => {
        const label = (context.locale === 'en' ? card.label : card.label_localized || card.label).toLowerCase();
        return context.keywords!.some(keyword => label.includes(keyword.toLowerCase()));
      });
    }

    // 6. 限制返回数量
    const limit = context.limit || 10;
    return filteredCards.slice(0, limit);
  }

  /**
   * 获取指定类别的卡片
   */
  getCardsByCategory(category: CardCategory): CardInfo[] {
    const allCards = this.getCachedCards();
    return allCards.filter(card => card.category === category);
  }

  /**
   * 根据ID获取卡片
   */
  getCardById(id: string): CardInfo | undefined {
    const allCards = this.getCachedCards();
    return allCards.find(card => card.id === id);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.storage.delete(this.CACHE_KEY);
    this.storage.delete(this.CACHE_VERSION_KEY);
    this.storage.delete(this.CACHE_TIMESTAMP_KEY);
    this.memoryCache = null;
    console.log('[CardCacheManager] Cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): CacheStats {
    const cards = this.getCachedCards();
    const cacheTimestamp = this.storage.getNumber(this.CACHE_TIMESTAMP_KEY);
    const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : 0;

    return {
      totalCards: cards.length,
      cardsByCategory: {
        [CardCategory.Topic]: cards.filter(c => c.category === CardCategory.Topic).length,
        [CardCategory.Emotion]: cards.filter(c => c.category === CardCategory.Emotion).length,
        [CardCategory.Action]: cards.filter(c => c.category === CardCategory.Action).length,
        [CardCategory.Core]: cards.filter(c => c.category === CardCategory.Core).length,
      },
      cacheVersion: this.storage.getString(this.CACHE_VERSION_KEY) || 'unknown',
      cacheAge,
      cacheTimestamp: cacheTimestamp || 0,
    };
  }
}

/**
 * 推荐上下文
 */
export interface RecommendationContext {
  category?: CardCategory;
  parentType?: ParentType;
  childGender?: ChildGender;
  locale?: UserLocale;
  keywords?: string[];
  limit?: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  totalCards: number;
  cardsByCategory: {
    [CardCategory.Topic]: number;
    [CardCategory.Emotion]: number;
    [CardCategory.Action]: number;
    [CardCategory.Core]: number;
  };
  cacheVersion: string;
  cacheAge: number;
  cacheTimestamp: number;
}

// 导出单例
export const cardCacheManager = CardCacheManager.instance;