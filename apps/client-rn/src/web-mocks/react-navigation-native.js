// Mock for @react-navigation/native - web compatible
import * as React from 'react';

// Simple web-based navigation container - renders child directly without wrapping
const NavigationContainerComponent = ({ children }) => {
  // Render children directly - they should be the Navigator component
  return children;
};

export const NavigationContainer = NavigationContainerComponent;

// Web compatible useNavigation hook
export const useNavigation = () => {
  return {
    navigate: (name, params) => console.log('Navigation:', name, params),
    goBack: () => console.log('Go back'),
    setParams: (params) => console.log('Set params:', params),
  };
};

// Web compatible useRoute hook
export const useRoute = () => {
  return {
    params: {},
    name: 'Screen',
  };
};

// Web compatible useScrollToTop hook
export const useScrollToTop = (ref) => {};

// Web compatible useLinkTo hook
export const useLinkTo = () => {
  return (path) => console.log('Link to:', path);
};

// Web compatible getState from navigation
export const getStateFromPath = (path, options) => {
  return { routes: [{ name: 'Screen' }] };
};

export const getPathFromState = (state, options) => {
  return '/';
};

export default {
  NavigationContainer,
  useNavigation,
  useRoute,
  useScrollToTop,
  useLinkTo,
  getStateFromPath,
  getPathFromState,
};
