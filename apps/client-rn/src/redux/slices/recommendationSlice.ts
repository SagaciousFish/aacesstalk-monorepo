import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { CardInfo, CardCategory, ParentType, ChildGender, UserLocale } from '@aacesstalk/libs/ts-core';
import { cardRecommender, RecommendationStrategy, RecommendationContext, RecommendationResult } from '../../services/card-recommender';
import { CoreState, CoreThunk } from '../store';

interface RecommendationState {
  currentRecommendations: CardInfo[];
  isRecommending: boolean;
  recommendationError: string | null;
  currentStrategy: RecommendationStrategy;
  recommendationHistory: Array<{
    context: RecommendationContext;
    result: RecommendationResult;
    timestamp: number;
  }>;
}

const initialState: RecommendationState = {
  currentRecommendations: [],
  isRecommending: false,
  recommendationError: null,
  currentStrategy: RecommendationStrategy.Hybrid,
  recommendationHistory: [],
};

/**
 * 推荐卡片
 */
export const recommendCards = createAsyncThunk(
  'recommendation/recommend',
  async (
    params: {
      context: RecommendationContext & { sessionId?: string; turnId?: string };
      strategy?: RecommendationStrategy;
    },
    { rejectWithValue }
  ) => {
    try {
      const result = await cardRecommender.recommend(params.context, params.strategy);
      return { result, context: params.context };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to recommend cards');
    }
  }
);

/**
 * 清除推荐缓存
 */
export const clearRecommendationCache = createAsyncThunk(
  'recommendation/clearCache',
  async (_, { rejectWithValue }) => {
    try {
      cardRecommender.clearCache();
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to clear cache');
    }
  }
);

const recommendationSlice = createSlice({
  name: 'recommendation',
  initialState,
  reducers: {
    setRecommending: (state, action: PayloadAction<boolean>) => {
      state.isRecommending = action.payload;
    },
    setRecommendationError: (state, action: PayloadAction<string | null>) => {
      state.recommendationError = action.payload;
    },
    setCurrentStrategy: (state, action: PayloadAction<RecommendationStrategy>) => {
      state.currentStrategy = action.payload;
    },
    clearCurrentRecommendations: (state) => {
      state.currentRecommendations = [];
    },
    clearRecommendationHistory: (state) => {
      state.recommendationHistory = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // 推荐卡片
      .addCase(recommendCards.pending, (state) => {
        state.isRecommending = true;
        state.recommendationError = null;
      })
      .addCase(recommendCards.fulfilled, (state, action) => {
        state.isRecommending = false;
        state.currentRecommendations = action.payload.result.cards;
        state.currentStrategy = action.payload.result.strategy;

        // 添加到历史记录
        state.recommendationHistory.push({
          context: action.payload.context,
          result: action.payload.result,
          timestamp: Date.now(),
        });

        // 限制历史记录数量
        if (state.recommendationHistory.length > 50) {
          state.recommendationHistory.shift();
        }

        state.recommendationError = null;
      })
      .addCase(recommendCards.rejected, (state, action) => {
        state.isRecommending = false;
        state.recommendationError = action.payload as string;
      })
      // 清除缓存
      .addCase(clearRecommendationCache.fulfilled, (state) => {
        console.log('[recommendation] Cache cleared');
      });
  },
});

/**
 * 便捷方法：推荐指定类别的卡片
 */
export const recommendCardsByCategory = (
  category: CardCategory,
  sessionId?: string,
  turnId?: string
): CoreThunk => {
  return async (dispatch, getState) => {
    const state = getState();
    const context: RecommendationContext & { sessionId?: string; turnId?: string } = {
      category,
      parentType: state.auth.dyadInfo?.parent_type,
      childGender: state.auth.dyadInfo?.child_gender,
      locale: state.auth.dyadInfo?.locale,
      sessionId,
      turnId,
    };

    return dispatch(recommendCards({ context }));
  };
};

/**
 * 便捷方法：根据关键词推荐卡片
 */
export const recommendCardsByKeywords = (
  keywords: string[],
  sessionId?: string,
  turnId?: string
): CoreThunk => {
  return async (dispatch, getState) => {
    const state = getState();
    const context: RecommendationContext & { sessionId?: string; turnId?: string } = {
      keywords,
      parentType: state.auth.dyadInfo?.parent_type,
      childGender: state.auth.dyadInfo?.child_gender,
      locale: state.auth.dyadInfo?.locale,
      sessionId,
      turnId,
    };

    return dispatch(recommendCards({ context }));
  };
};

export const {
  setRecommending,
  setRecommendationError,
  setCurrentStrategy,
  clearCurrentRecommendations,
  clearRecommendationHistory,
} = recommendationSlice.actions;

export default recommendationSlice.reducer;