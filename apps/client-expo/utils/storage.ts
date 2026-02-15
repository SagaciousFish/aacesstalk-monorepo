import { Platform } from 'react-native';

// Portable storage helpers used by client-expo. Preference order:
// 1) expo-secure-store (preferred for Expo apps)
// 2) react-native-mmkv (if available)
// 3) @react-native-async-storage/async-storage
// 4) window.localStorage (web)

export async function getString(key: string): Promise<string | null> {
  // Try Expo SecureStore first (async)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch (e) {
    // continue to fallbacks
  }

  // Try MMKV (sync) lazily
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    const v = storage.getString(key);
    if (v != null) return v;
  } catch (e) {
    // try AsyncStorage
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const v = await AsyncStorage.getItem(key);
    if (v != null) return v;
  } catch (e) {
    // try localStorage (web)
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(key);
      if (v != null) return v;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export async function setString(key: string, value: string): Promise<void> {
  // Try Expo SecureStore first
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
    return;
  } catch (e) {
    // continue to fallbacks
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    storage.set(key, value);
    return;
  } catch (e) {
    // try AsyncStorage
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
    return;
  } catch (e) {
    // try localStorage (web)
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (e) {
    // ignore
  }

  return;
}
