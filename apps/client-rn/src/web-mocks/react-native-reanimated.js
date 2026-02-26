// Web implementation for react-native-reanimated
// Uses basic implementations that work in browser

import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Basic hooks and functions that work in browser
function useSharedValue(initial) {
  return React.useRef(initial);
}

function useAnimatedStyle(styleFn) {
  return styleFn();
}

function useDerivedValue(derivedFn) {
  return { value: derivedFn() };
}

function useAnimatedReaction() {}

function withTiming(toValue, config, callback) { return toValue; }
function withSpring(toValue, config, callback) { return toValue; }
function withDelay(delay, animation) { return animation; }
function withSequence() { return arguments[0]; }
function withRepeat(animation) { return animation; }

function interpolate(value, inputRange, outputRange) {
  return value;
}

function interpolateColor(value, inputRange, outputRange, colorSpace = 'RGB') {
  // Simple implementation: find the appropriate color based on input range
  if (!Array.isArray(inputRange) || !Array.isArray(outputRange)) {
    return outputRange[0] || 'rgba(0,0,0,1)';
  }

  // Find the index where value falls in the input range
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      // Linear interpolation between colors
      const t = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return interpolateTwoColors(outputRange[i], outputRange[i + 1], t);
    }
  }

  // If value is outside range, return closest edge
  if (value < inputRange[0]) return outputRange[0];
  return outputRange[outputRange.length - 1];
}

function interpolateTwoColors(color1, color2, t) {
  // Parse rgba(r, g, b, a) format
  const parseColor = (color) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
      };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  };

  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  const a = c1.a + (c2.a - c1.a) * t;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend' };

const Easing = {
  linear: t => t,
  ease: t => t * (2 - t),
  quad: t => t * t,
  cubic: t => t * t * t,
  sin: t => 1 - Math.cos(t * Math.PI / 2),
  circle: t => 1 - Math.sqrt(1 - t * t),
  exp: t => Math.pow(2, 10 * (t - 1)),
  back: (c, t) => {
    const s = c || 1.70158;
    return t * t * ((s + 1) * t - s);
  },
  elastic: (c, t) => {
    const p = c || 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  bounce: t => {
    let n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  // Higher-order easing functions
  in: (easing) => {
    return typeof easing === 'function' ? easing : (t => easing(t));
  },
  out: (easing) => {
    return typeof easing === 'function' ? (t => 1 - easing(1 - t)) : (t => 1 - easing(1 - t));
  },
  inOut: (easing) => {
    return typeof easing === 'function' ? (t => {
      if (t < 0.5) return easing(2 * t) / 2;
      return 1 - easing(2 * (1 - t)) / 2;
    }) : (t => {
      if (t < 0.5) return easing(2 * t) / 2;
      return 1 - easing(2 * (1 - t)) / 2;
    });
  },
};

const runOnUI = fn => fn;
const runOnJS = fn => fn;
const createAnimatedComponent = Component => Component;

const LayoutAnimation = {
  springify: () => ({ ...LayoutAnimation, duration: () => LayoutAnimation }),
  LinearTransition: createAnimation('LinearTransition'),
  FadingTransition: {},
};

// Animation helper to create entering/exiting animations with .duration(), .springify(), .easing() methods
function createAnimation(animType) {
  const obj = {};
  obj.duration = function(d) { return obj; };
  obj.springify = function() { return obj; };
  obj.easing = function(e) { return obj; };
  obj.withCallback = function(cb) { return obj; };
  return obj;
}

const FadeIn = createAnimation('FadeIn');
const FadeOut = createAnimation('FadeOut');
const SlideInDown = createAnimation('SlideInDown');
const SlideInUp = createAnimation('SlideInUp');
const SlideInLeft = createAnimation('SlideInLeft');
const SlideInRight = createAnimation('SlideInRight');
const ZoomIn = createAnimation('ZoomIn');
const ZoomOut = createAnimation('ZoomOut');
const FlipInXUp = createAnimation('FlipInXUp');
const FlipOutXDown = createAnimation('FlipOutXDown');
const FlipInYLeft = createAnimation('FlipInYLeft');
const FlipOutEasyY = createAnimation('FlipOutEasyY');
const LayoutAnimationConfig = (props) => props.children;

// Reanimated object - exported as default
const Reanimated = {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  runOnUI,
  runOnJS,
  createAnimatedComponent,
  LayoutAnimation,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  ZoomOut,
  FlipInXUp,
  FlipOutXDown,
  FlipInYLeft,
  FlipOutEasyY,
  LayoutAnimationConfig,
};

Reanimated.View = View;
Reanimated.Text = Text;
Reanimated.ScrollView = ScrollView;
Reanimated.TextInput = TextInput;
Reanimated.TouchableOpacity = TouchableOpacity;
Reanimated.Platform = { OS: 'web', select: obj => obj.web || obj.default };
Reanimated.Dimensions = { get: () => ({ width, height }) };
Reanimated.interpolateColor = interpolateColor;

// Named exports for direct imports
export {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  runOnUI,
  runOnJS,
  createAnimatedComponent,
  LayoutAnimation,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  ZoomOut,
  FlipInXUp,
  FlipOutXDown,
  FlipInYLeft,
  FlipOutEasyY,
  LayoutAnimationConfig,
};

export default Reanimated;
