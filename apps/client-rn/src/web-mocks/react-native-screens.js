// Mock for react-native-screens - web compatible
import * as React from 'react';
import { View } from 'react-native';

// NativeScreen - just renders children
export const NativeScreen = ({ children, style, ...props }) => {
  return React.createElement(View, { style }, children);
};

// NativeScreenContainer - just renders children
export const NativeScreenContainer = ({ children, style, ...props }) => {
  return React.createElement(View, { style }, children);
};

// EnableScreens - no-op for web
export const enableScreens = () => {};

// Screen - alias for NativeScreen
export const Screen = NativeScreen;

// ScreenContainer - alias for NativeScreenContainer
export const ScreenContainer = NativeScreenContainer;

export default {
  NativeScreen,
  NativeScreenContainer,
  enableScreens,
  Screen,
  ScreenContainer,
};
