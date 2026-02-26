// Web implementation for react-native-reanimated
// Uses requestAnimationFrame for real animations with a reactive shared value system

import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Tracking context — lets useAnimatedStyle discover which shared values it reads
// ---------------------------------------------------------------------------
let _currentTracker = null;

// ---------------------------------------------------------------------------
// Shared value — reactive, animator-aware
// ---------------------------------------------------------------------------
function createSharedValue(initial) {
  let _value = initial;
  let _animFrameId = null;
  const _subscribers = new Set();

  const sv = {
    get value() {
      if (_currentTracker) _currentTracker.add(sv);
      return _value;
    },
    set value(newVal) {
      if (_animFrameId !== null) {
        cancelAnimationFrame(_animFrameId);
        _animFrameId = null;
      }
      if (newVal !== null && typeof newVal === 'object' && newVal._isAnimationDescriptor) {
        _runAnimation(sv, newVal);
      } else {
        _value = newVal;
        _subscribers.forEach(cb => cb());
      }
    },
    // Internal helpers — not part of the public API
    _getRaw: () => _value,
    _setRaw(v) {
      _value = v;
      _subscribers.forEach(cb => cb());
    },
    _subscribe(cb) {
      _subscribers.add(cb);
      return () => _subscribers.delete(cb);
    },
    _setFrameId(id) { _animFrameId = id; },
    _cancelAnim() {
      if (_animFrameId !== null) { cancelAnimationFrame(_animFrameId); _animFrameId = null; }
    },
  };
  return sv;
}

// ---------------------------------------------------------------------------
// Animation runner
// ---------------------------------------------------------------------------
function _runAnimation(sv, descriptor) {
  const { _type, toValue, duration, easingFn, stiffness, damping, mass, callback } = descriptor;

  if (_type === 'timing') {
    const startValue = sv._getRaw();
    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFn ? easingFn(progress) : progress;
      sv._setRaw(startValue + (toValue - startValue) * easedProgress);

      if (progress < 1) {
        sv._setFrameId(requestAnimationFrame(frame));
      } else {
        sv._setFrameId(null);
        if (callback) callback(true);
      }
    };
    sv._setFrameId(requestAnimationFrame(frame));

  } else if (_type === 'spring') {
    // Simple critically-damped spring approximation
    const k = stiffness ?? 100;
    const c = damping ?? 10;
    const m = mass ?? 1;
    const startValue = sv._getRaw();
    let vel = 0;
    let pos = startValue;
    let lastTime = performance.now();

    const frame = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.064); // cap at 64ms
      lastTime = now;
      const force = -k * (pos - toValue) - c * vel;
      vel += (force / m) * dt;
      pos += vel * dt;
      sv._setRaw(pos);

      const atRest = Math.abs(pos - toValue) < 0.01 && Math.abs(vel) < 0.01;
      if (!atRest) {
        sv._setFrameId(requestAnimationFrame(frame));
      } else {
        sv._setRaw(toValue);
        sv._setFrameId(null);
        if (callback) callback(true);
      }
    };
    sv._setFrameId(requestAnimationFrame(frame));
  }
}

// ---------------------------------------------------------------------------
// Public API hooks
// ---------------------------------------------------------------------------
function useSharedValue(initial) {
  const ref = React.useRef(null);
  if (ref.current === null) {
    ref.current = createSharedValue(initial);
  }
  return ref.current;
}

function useAnimatedStyle(styleFn) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const svSetRef = React.useRef(new Set());
  const unsubs = React.useRef([]);

  // Run styleFn in tracking mode to discover which shared values it reads
  const track = () => {
    const discovered = new Set();
    _currentTracker = discovered;
    let style = {};
    try { style = styleFn(); } catch (e) {}
    _currentTracker = null;

    // Unsubscribe from values no longer used
    unsubs.current.forEach(u => u());
    unsubs.current = [];
    svSetRef.current = discovered;

    // Subscribe to each discovered shared value
    discovered.forEach(sv => {
      const unsub = sv._subscribe(() => {
        forceUpdate();
      });
      unsubs.current.push(unsub);
    });

    return style;
  };

  // Run tracking once on mount and whenever the component re-renders
  const styleRef = React.useRef({});
  styleRef.current = track();

  React.useEffect(() => {
    // Re-track on mount (effect runs after render, ensures subscriptions are fresh)
    styleRef.current = track();
    return () => {
      unsubs.current.forEach(u => u());
      unsubs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return styleRef.current;
}

function useDerivedValue(derivedFn) {
  const sv = useSharedValue(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    const discovered = new Set();
    _currentTracker = discovered;
    let val;
    try { val = derivedFn(); } catch (e) {}
    _currentTracker = null;
    sv._setRaw(val);

    const unsubs = [];
    discovered.forEach(dep => {
      unsubs.push(dep._subscribe(() => {
        _currentTracker = null;
        try { sv._setRaw(derivedFn()); } catch (e) {}
      }));
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return sv;
}

function useAnimatedReaction(prepareFn, effectFn, deps) {
  React.useEffect(() => {
    const discovered = new Set();
    _currentTracker = discovered;
    try { prepareFn(); } catch (e) {}
    _currentTracker = null;

    const unsubs = [];
    discovered.forEach(sv => {
      unsubs.push(sv._subscribe(() => {
        try { effectFn(prepareFn()); } catch (e) {}
      }));
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || []);
}

// ---------------------------------------------------------------------------
// Animation factories
// ---------------------------------------------------------------------------
function withTiming(toValue, config = {}, callback) {
  return {
    _isAnimationDescriptor: true,
    _type: 'timing',
    toValue,
    duration: config.duration ?? 300,
    easingFn: config.easing ?? null,
    callback,
  };
}

function withSpring(toValue, config = {}, callback) {
  return {
    _isAnimationDescriptor: true,
    _type: 'spring',
    toValue,
    stiffness: config.stiffness ?? 100,
    damping: config.damping ?? 10,
    mass: config.mass ?? 1,
    callback,
  };
}

function withDelay(delay, animation) {
  return {
    _isAnimationDescriptor: true,
    _type: 'delay',
    delay,
    inner: animation,
  };
}

function withSequence(...animations) {
  // Return the last animation value for static use; real sequencing needs a runner
  return animations[animations.length - 1] ?? 0;
}

function withRepeat(animation, numberOfReps, reverse, callback) {
  return animation;
}

// ---------------------------------------------------------------------------
// interpolate — actual linear interpolation with clamping
// ---------------------------------------------------------------------------
function interpolate(value, inputRange, outputRange, extrapolation) {
  if (!Array.isArray(inputRange) || !Array.isArray(outputRange) || inputRange.length < 2) {
    return typeof value === 'object' && value !== null ? value._getRaw?.() ?? 0 : value;
  }

  const v = typeof value === 'object' && value !== null && value._getRaw ? value._getRaw() : value;

  if (v <= inputRange[0]) return outputRange[0];
  if (v >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];

  for (let i = 0; i < inputRange.length - 1; i++) {
    if (v >= inputRange[i] && v <= inputRange[i + 1]) {
      const t = (v - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + (outputRange[i + 1] - outputRange[i]) * t;
    }
  }
  return outputRange[outputRange.length - 1];
}

function interpolateColor(value, inputRange, outputRange, colorSpace = 'RGB') {
  if (!Array.isArray(inputRange) || !Array.isArray(outputRange)) {
    return outputRange[0] || 'rgba(0,0,0,1)';
  }

  const v = typeof value === 'object' && value !== null && value._getRaw ? value._getRaw() : value;

  if (v <= inputRange[0]) return outputRange[0];
  if (v >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];

  for (let i = 0; i < inputRange.length - 1; i++) {
    if (v >= inputRange[i] && v <= inputRange[i + 1]) {
      const t = (v - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return _interpolateTwoColors(outputRange[i], outputRange[i + 1], t);
    }
  }
  return outputRange[outputRange.length - 1];
}

function _parseColor(color) {
  if (typeof color !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
  }
  // Handle hex
  const hex = color.replace('#', '');
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function _interpolateTwoColors(c1, c2, t) {
  const a = _parseColor(c1);
  const b = _parseColor(c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  const al = a.a + (b.a - a.a) * t;
  return `rgba(${r}, ${g}, ${bl}, ${al})`;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend' };

const Easing = {
  linear: t => t,
  ease: t => t * (2 - t),
  quad: t => t * t,
  cubic: t => t * t * t,
  sin: t => 1 - Math.cos(t * Math.PI / 2),
  circle: t => 1 - Math.sqrt(1 - t * t),
  exp: t => Math.pow(2, 10 * (t - 1)),
  back: (c) => (t) => {
    const s = c ?? 1.70158;
    return t * t * ((s + 1) * t - s);
  },
  elastic: (c) => (t) => {
    const p = c ?? 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  bounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  in: (easing) => easing,
  out: (easing) => (t) => 1 - easing(1 - t),
  inOut: (easing) => (t) => t < 0.5 ? easing(2 * t) / 2 : 1 - easing(2 * (1 - t)) / 2,
  bezier: (x1, y1, x2, y2) => t => t, // approximation
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const runOnUI = fn => fn;
const runOnJS = fn => fn;
const createAnimatedComponent = Component => Component;

function createAnimation() {
  const obj = {};
  obj.duration = () => obj;
  obj.springify = () => obj;
  obj.easing = () => obj;
  obj.withCallback = () => obj;
  obj.delay = () => obj;
  return obj;
}

const LayoutAnimation = {
  springify: () => ({ ...LayoutAnimation, duration: () => LayoutAnimation }),
  LinearTransition: createAnimation(),
  FadingTransition: {},
};

const FadeIn = createAnimation();
const FadeOut = createAnimation();
const SlideInDown = createAnimation();
const SlideInUp = createAnimation();
const SlideInLeft = createAnimation();
const SlideInRight = createAnimation();
const ZoomIn = createAnimation();
const ZoomOut = createAnimation();
const FlipInXUp = createAnimation();
const FlipOutXDown = createAnimation();
const FlipInYLeft = createAnimation();
const FlipOutEasyY = createAnimation();
const LayoutAnimationConfig = (props) => props.children;

// ---------------------------------------------------------------------------
// Default export (mirrors Reanimated namespace)
// ---------------------------------------------------------------------------
const Reanimated = {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform: { OS: 'web', select: obj => obj.web ?? obj.default },
  Dimensions: { get: () => ({ width, height }) },
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
