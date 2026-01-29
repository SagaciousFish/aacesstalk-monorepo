import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Device from 'expo-device';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  fade: true,
});

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [isReady, setIsReady] = useState(false);

  setTimeout(async () => {
    await SplashScreen.hideAsync();
    setIsReady(true);
  }, 600000);

  useEffect(() => {
    async function setupOrientation() {
      const deviceType = await Device.getDeviceTypeAsync();
      const isTablet = deviceType === Device.DeviceType.TABLET || deviceType === Device.DeviceType.DESKTOP;

      if (isTablet) {
        // Unlock all orientations for tablets
        await ScreenOrientation.unlockAsync();
      } else {
        // Lock to portrait for phones
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    setupOrientation();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
