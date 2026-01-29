import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { CardInfo, CardCategory, ParentType, ChildGender, UserLocale } from '@aacesstalk/libs/ts-core';
import { cardCacheManager, RecommendationContext, CacheStats } from '../../services/card-cache';
import { CoreState, CoreThunk } from '../store';

interface CardCacheState {
  cards: CardInfo[];
  isPreloading: boolean;
  preloadError: string | null;
  lastPreloadTime: number | null;
  cacheStats: CacheStats | null;
}

const initialState: CardCacheState = {
  cards: [],
  isPreloading: false,
  preloadError: null,
  lastPreloadTime: null,
  cacheStats: null,
};

/**
 * 预加载卡片数据
 */
export const preloadCards = createAsyncThunk(
  'cardCache/preload',
  async (forceRefresh = false, { rejectWithValue }) => {
    try {
      const cards = await cardCacheManager.preloadCards(forceRefresh);
      return { cards, timestamp: Date.now() };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to preload cards');
    }
  }
);

/**
 * 获取缓存统计信息
 */
export const getCacheStats = createAsyncThunk(
  'cardCache/getStats',
  async (_, { getState }) => {
    return cardCacheManager.getCacheStats();
  }
);

/**
 * 清除卡片缓存
 */
export const clearCache = createAsyncThunk(
  'cardCache/clear',
  async (_, { getState }) => {
    cardCacheManager.clearCache();
    return null;
  }
);

const cardCacheSlice = createSlice({
  name: 'cardCache',
  initialState,
  reducers: {
    setPreloading: (state, action: PayloadAction<boolean>) => {
      state.isPreloading = action.payload;
    },
    setPreloadError: (state, action: PayloadAction<string | null>) => {
      state.preloadError = action.payload;
    },
    resetCacheState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // 预加载卡片
      .addCase(preloadCards.pending, (state) => {
        state.isPreloading = true;
        state.preloadError = null;
      })
      .addCase(preloadCards.fulfilled, (state, action) => {
        state.isPreloading = false;
        state.cards = action.payload.cards;
        state.lastPreloadTime = action.payload.timestamp;
        state.preloadError = null;
      })
      .addCase(preloadCards.rejected, (state, action) => {
        state.isPreloading = false;
        state.preloadError = action.payload as string;
      })
      // 获取缓存统计
      .addCase(getCacheStats.fulfilled, (state, action) => {
        state.cacheStats = action.payload;
      })
      // 清除缓存
      .addCase(clearCache.fulfilled, (state) => {
        state.cards = [];
        state.lastPreloadTime = null;
        state.cacheStats = null;
      });
  },
});

/**
 * 根据上下文推荐卡片（本地规则推荐）
 */
export const recommendCardsLocally = (context: RecommendationContext): CoreThunk => {
  return (dispatch, getState) => {
    const state = getState();
    if (state.cardCache.cards.length === 0) {
      console.warn('[cardCache] No cards loaded, cannot recommend locally');
      return [];
    }

    const recommended = cardCacheManager.recommendCards(context);
    console.log(`[cardCache] Recommended ${recommended.length} cards locally`);
    return recommended;
  };
};

/**
 * 获取指定类别的卡片
 */
export const getCardsByCategory = (category: CardCategory): CoreThunk<CardInfo[]> => {
  return (dispatch, getState) => {
    const state = getState();
    if (state.cardCache.cards.length === 0) {
      console.warn('[cardCache] No cards loaded');
      return [];
    }

    return cardCacheManager.getCardsByCategory(category);
  };
};

/**
 * 根据ID获取卡片
 */
export const getCardById = (id: string): CoreThunk<CardInfo | undefined> => {
  return (dispatch, getState) => {
    const state = getState();
    if (state.cardCache.cards.length === 0) {
      console.warn('[cardCache] No cards loaded');
      return undefined;
    }

    return cardCacheManager.getCardById(id);
  };
};

export const { setPreloading, setPreloadError, resetCacheState } = cardCacheSlice.actions;
export default cardCacheSlice.reducer;