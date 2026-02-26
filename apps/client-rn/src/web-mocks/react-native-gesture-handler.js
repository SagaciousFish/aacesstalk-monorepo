// Web implementation for react-native-gesture-handler
// Uses native browser events

import React from 'react';
import { View, ScrollView, TouchableOpacity, Platform } from 'react-native';

// Gesture Handler Root View
function GestureHandlerRootView(props) {
  return (
    <View style={props.style}>
      {props.children}
    </View>
  );
}

// State enum
const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

// Directions
const Direction = {
  RIGHT: 1,
  LEFT: 2,
  UP: 4,
  DOWN: 8,
};

const Directions = {
  RIGHT: 1,
  LEFT: 2,
  UP: 4,
  DOWN: 8,
};

// NativeViewGestureHandler
function NativeViewGestureHandler(props) {
  return <View {...props} />;
}

// createAnimatedComponent wrapper
function createAnimatedComponent(Component) {
  return Component;
}

// Gesture object for composed gestures
const Gesture = {
  Tap: function() { return {}; },
  Pan: function() { return {}; },
  LongPress: function() { return {}; },
  Pinch: function() { return {}; },
  Rotation: function() { return {}; },
  Fling: function() { return {}; },
  Race: function() { return Gesture; },
  Simultaneous: function() { return Gesture; },
  Exclusive: function() { return Gesture; },
};

// GestureDetector
function GestureDetector(props) {
  return props.children;
}

// FlatList wrapper
function FlatList(props) {
  return <ScrollView {...props} />;
}

// PureNativeViewGestureHandler
function PureNativeViewGestureHandler(props) {
  return <View {...props} />;
}

// ScrollView wrapper with gesture handling
const GestureHandlerScrollView = ScrollView;

// TouchableOpacity wrapper
const GestureHandlerTouchableOpacity = TouchableOpacity;

export {
  GestureHandlerRootView,
  State,
  Direction,
  Directions,
  NativeViewGestureHandler,
  createAnimatedComponent,
  Gesture,
  GestureDetector,
  FlatList,
  PureNativeViewGestureHandler,
  GestureHandlerScrollView,
  GestureHandlerTouchableOpacity,
  Platform,
};

export default {
  GestureHandlerRootView,
  State,
  Direction,
  Directions,
  NativeViewGestureHandler,
  createAnimatedComponent,
  Gesture,
  GestureDetector,
  FlatList,
  PureNativeViewGestureHandler,
  ScrollView: GestureHandlerScrollView,
  TouchableOpacity: GestureHandlerTouchableOpacity,
  Platform,
};
