// Mock for @react-navigation/native-stack - web compatible
import * as React from 'react';

// Simple web-based stack navigator
export const createNativeStackNavigator = () => {
  // Screen component - placeholder, doesn't render anything
  const Screen = (props) => {
    return null;
  };

  // Navigator - renders the active screen
  const Navigator = ({ children, screenOptions, initialRouteName, id, ...props }) => {
    // Handle conditional rendering from ternary operator
    let childArray = [];
    if (children) {
      if (Array.isArray(children)) {
        childArray = children.filter(c => c != null && c !== false && typeof c !== 'string');
      } else if (typeof children === 'object' && children !== null) {
        childArray = [children];
      }
    }

    if (childArray.length === 0) {
      return null;
    }

    // Find the screen to render - use the first valid one
    let activeScreen = null;
    for (const child of childArray) {
      if (child?.props?.component) {
        activeScreen = child;
        break;
      }
    }

    if (!activeScreen) {
      return null;
    }

    // Get the component to render
    const Component = activeScreen?.props?.component;
    if (!Component) {
      return null;
    }

    // Return the component directly - React will handle rendering
    return React.createElement(Component, { navigation: {} });
  };

  return {
    Navigator,
    Screen,
  };
};

export const defaultNativeStackOptions = {
  headerShown: false,
};

export default {
  createNativeStackNavigator,
  defaultNativeStackOptions,
};
