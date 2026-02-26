// Web stub for @sayem314/react-native-keep-awake
// The Web Screen Wake Lock API is gated behind HTTPS + user gesture, so we
// attempt it but silently fall back to a no-op when unavailable.

let wakeLock = null;

async function acquireWakeLock() {
  if (!navigator?.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    document.addEventListener('visibilitychange', async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
      }
    }, { once: false });
  } catch {
    // Not available (HTTP, permission denied, etc.) — silently ignore
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

export function useKeepAwake() {
  // React hook — acquire on mount, release on unmount
  const { useEffect } = require('react');
  useEffect(() => {
    acquireWakeLock();
    return () => { releaseWakeLock(); };
  }, []);
}

export const activateKeepAwake = acquireWakeLock;
export const deactivateKeepAwake = releaseWakeLock;

export default { useKeepAwake, activateKeepAwake, deactivateKeepAwake };
