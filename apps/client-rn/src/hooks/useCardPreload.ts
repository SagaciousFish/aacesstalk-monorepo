import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from '../redux/hooks';
import { preloadCards, getCacheStats } from '../redux/slices/cardCacheSlice';
import { RootState } from '../redux/store';

/**
 * 卡片预加载 Hook
 * 在用户登录后自动预加载卡片数据
 */
export const useCardPreload = () => {
  const dispatch = useDispatch();
  const isSignedIn = useSelector((state: RootState) => state.auth.jwt != null);
  const isPreloading = useSelector((state: RootState) => state.cardCache.isPreloading);
  const preloadError = useSelector((state: RootState) => state.cardCache.preloadError);
  const lastPreloadTime = useSelector((state: RootState) => state.cardCache.lastPreloadTime);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    // 只在用户登录后且未加载过时预加载
    if (isSignedIn && !hasLoadedOnce.current && !isPreloading) {
      console.log('[useCardPreload] Starting card preload...');

      dispatch(preloadCards(false))
        .unwrap()
        .then(() => {
          console.log('[useCardPreload] Cards preloaded successfully');
          hasLoadedOnce.current = true;

          // 获取缓存统计信息
          dispatch(getCacheStats());
        })
        .catch((error) => {
          console.error('[useCardPreload] Failed to preload cards:', error);
        });
    }
  }, [isSignedIn, dispatch, isPreloading]);

  return {
    isPreloading,
    preloadError,
    lastPreloadTime,
    hasLoaded: hasLoadedOnce.current,
  };
};

/**
 * 手动刷新卡片缓存
 */
export const useRefreshCards = () => {
  const dispatch = useDispatch();

  const refresh = async () => {
    console.log('[useRefreshCards] Refreshing cards...');
    try {
      await dispatch(preloadCards(true)).unwrap();
      console.log('[useRefreshCards] Cards refreshed successfully');
      await dispatch(getCacheStats());
      return true;
    } catch (error) {
      console.error('[useRefreshCards] Failed to refresh cards:', error);
      return false;
    }
  };

  return { refresh };
};