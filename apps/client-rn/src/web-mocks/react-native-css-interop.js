// Mock for react-native-css-interop
// This package is not needed for web - it's for React Native CSS styling

// Dummy createInteropElement - react-navigation may try to use this
const createInteropElement = (component) => component;

export const enableExperimentalCSSInterpolation = () => {};
export const addCSSNativeLayers = () => {};
export { createInteropElement };
export default {
  enableExperimentalCSSInterpolation,
  addCSSNativeLayers,
  createInteropElement,
};
