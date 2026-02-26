// Web implementation for react-native-safe-area-context
// Uses CSS env() for safe area simulation

import React from 'react';
import { View, Text, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Get safe area insets from CSS or provide defaults
const getSafeAreaInsets = () => {
  // Try to get from CSS custom properties (if set)
  const style = window.getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 20,
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) || 20,
    left: parseInt(style.getPropertyValue('--sal') || '0', 10) || 0,
    right: parseInt(style.getPropertyValue('--sar') || '0', 10) || 0,
  };
};

// SafeAreaContext
const SafeAreaContext = React.createContext({
  insets: { top: 20, bottom: 20, left: 0, right: 0 },
});

// SafeAreaInsetsContext - needed by @react-navigation/elements
const SafeAreaInsetsContext = React.createContext({
  top: 20,
  bottom: 20,
  left: 0,
  right: 0,
});

// SafeAreaFrameContext - needed by @react-navigation/elements
const SafeAreaFrameContext = React.createContext({
  x: 0,
  y: 0,
  width,
  height,
});

// SafeAreaView component
function SafeAreaView({ children, style, edges = ['top', 'bottom', 'left', 'right'] }) {
  const { insets } = React.useContext(SafeAreaContext);

  const paddingStyle = {};
  if (edges.includes('top')) paddingStyle.paddingTop = insets.top;
  if (edges.includes('bottom')) paddingStyle.paddingBottom = insets.bottom;
  if (edges.includes('left')) paddingStyle.paddingLeft = insets.left;
  if (edges.includes('right')) paddingStyle.paddingRight = insets.right;

  return (
    <View style={[style, paddingStyle]}>
      {children}
    </View>
  );
}

// Hook to get safe area insets
function useSafeAreaInsets() {
  const { insets } = React.useContext(SafeAreaContext);
  return insets;
}

// Hook to get safe area frame
function useSafeAreaFrame() {
  return { x: 0, y: 0, width, height };
}

// SafeAreaProvider
function SafeAreaProvider({ children }) {
  const [insets, setInsets] = React.useState({
    top: 20,
    bottom: 20,
    left: 0,
    right: 0,
  });

  React.useEffect(() => {
    // Try to get from CSS
    const updateInsets = () => {
      const style = window.getComputedStyle(document.documentElement);
      const sat = parseInt(style.getPropertyValue('--sat') || '20', 10);
      const sab = parseInt(style.getPropertyValue('--sab') || '20', 10);
      const sal = parseInt(style.getPropertyValue('--sal') || '0', 10);
      const sar = parseInt(style.getPropertyValue('--sar') || '0', 10);

      setInsets({
        top: sat || 20,
        bottom: sab || 20,
        left: sal || 0,
        right: sar || 0,
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);

    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return (
    <SafeAreaContext.Provider value={{ insets }}>
      {children}
    </SafeAreaContext.Provider>
  );
}

// Initial metrics
const initialWindowMetrics = {
  insets: {
    top: 20,
    bottom: 20,
    left: 0,
    right: 0,
  },
  frame: { x: 0, y: 0, width, height },
};

// useSafeAreaMetrics hook
function useSafeAreaMetrics() {
  return initialWindowMetrics;
}

// For react-navigation compatibility
function maybeHijackSafeAreaProvider(provider) {
  return provider;
}

export {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  useSafeAreaFrame,
  useSafeAreaMetrics,
  SafeAreaContext,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  initialWindowMetrics,
  maybeHijackSafeAreaProvider,
};

export default {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  useSafeAreaFrame,
  useSafeAreaMetrics,
  SafeAreaContext,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  initialWindowMetrics,
  maybeHijackSafeAreaProvider,
};
