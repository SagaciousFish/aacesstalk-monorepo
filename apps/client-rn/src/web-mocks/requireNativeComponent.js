// Mock for react-native requireNativeComponent
// Returns a functional component that renders a View

import React from 'react';
import { View, Text } from 'react-native';

export default function requireNativeComponent(name) {
  console.warn(`requireNativeComponent: ${name} is not available in web`);

  // Return a fallback component
  return (props) => {
    // Fallback to a View for most components
    return React.createElement(View, {
      ...props,
      style: { ...props.style, opacity: 0.5 }
    });
  };
}
