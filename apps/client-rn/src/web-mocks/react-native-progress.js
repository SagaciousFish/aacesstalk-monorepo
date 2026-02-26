// Web implementation for react-native-progress
// Uses SVG for progress indicators

import React from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

// Progress bar (uncontrolled)
function ProgressBar(props) {
  const {
    progress = 0,
    indeterminate = false,
    color = '#1976D2',
    unfilledColor = '#E0E0E0',
    borderColor = 'transparent',
    borderWidth = 0,
    width = 150,
    height = 6,
    showsText = false,
    text,
    formatText,
Animated = true    progress,
  } = props;

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (indeterminate) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [indeterminate]);

  const widthValue = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.progressBar,
        {
          width,
          height,
          backgroundColor: unfilledColor,
          borderColor,
          borderWidth,
        },
      ]}
    >
      {indeterminate ? (
        <Animated.View
          style={[
            styles.indeterminateBar,
            {
              width: widthValue,
              backgroundColor: color,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.determinateBar,
            {
              width: typeof progress === 'number' ? `${progress * 100}%` : '0%',
              backgroundColor: color,
            },
          ]}
        />
      )}
    </View>
  );
}

// Circle progress indicator
function Circle(props) {
  const {
    size = 60,
    progress = 0,
    indeterminate = false,
    color = '#1976D2',
    unfilledColor = '#E0E0E0',
    borderWidth = 4,
    showsText = false,
    formatText = (progress) => `${Math.round(progress * 100)}%`,
  } = props;

  const radius = (size - borderWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (indeterminate) {
      const animation = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      animation.start();
      return () => animation.stop();
    }
  }, [indeterminate]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const progressValue = progress * circumference;

  return (
    <View style={[styles.circle, { width: size, height: size }]}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={unfilledColor}
          strokeWidth={borderWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={borderWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? strokeDashoffset : circumference - progressValue}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showsText && (
        <View style={styles.circleText}>
          <Text>
            {formatText
              ? formatText(progress)
              : indeterminate
              ? ''
              : `${Math.round(progress * 100)}%`}
          </Text>
        </View>
      )}
    </View>
  );
}

// CircleSnail - indeterminate circle
function CircleSnail(props) {
  const {
    size = 50,
    color = '#1976D2',
    thickness = 0.2,
    showsText = false,
  } = props;

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const rotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.snail,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: size * thickness,
          borderColor: color,
          transform: [{ rotate: rotation }],
        },
      ]}
    />
  );
}

// Pie progress
function Pie(props) {
  const {
    size = 60,
    progress = 0,
    color = '#1976D2',
    unfilledColor = '#E0E0E0',
    showsText = false,
  } = props;

  const radius = size / 2;
  const angle = progress * 360;

  return (
    <View style={[styles.pie, { width: size, height: size }]}>
      <svg width={size} height={size}>
        {/* Background */}
        <circle cx={radius} cy={radius} r={radius} fill={unfilledColor} />
        {/* Progress */}
        {progress > 0 && (
          <circle
            cx={radius}
            cy={radius}
            r={radius}
            fill={color}
            clipPath={`polygon(50% 50%, 50% 0%, ${50 + radius * Math.sin((angle * Math.PI) / 180)}% ${50 - radius * Math.cos((angle * Math.PI) / 180)}%, 0% 0%, 0% 100%)`}
          />
        )}
      </svg>
    </View>
  );
}

// Wave progress
function Wave(props) {
  const {
    size = 60,
    progress = 0,
    color = '#1976D2',
    unfilledColor = '#E0E0E0',
    borderRadius = 0,
  } = props;

  return (
    <View style={[styles.wave, { width: size, height: size, borderRadius }]}>
      <View
        style={[
          styles.waveBackground,
          { backgroundColor: unfilledColor },
        ]}
      />
      <View
        style={[
          styles.waveProgress,
          {
            backgroundColor: color,
            height: `${progress * 100}%`,
          },
        ]}
      />
    </View>
  );
}

// Shimmer effect
function Shimmer(props) {
  const {
    width = 200,
    height = 20,
    color = '#E0E0E0',
    shimmerColor = '#F5F5F5',
  } = props;

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        {
          width,
          height,
          backgroundColor: color,
        },
        { opacity },
      ]}
    />
  );
}

const Progress = {
  Bar: ProgressBar,
  Circle,
  Pie,
  Wave,
  Shimmer,
  CircleSnail,
};

export { ProgressBar, Circle, Pie, Wave, Shimmer, CircleSnail, Progress };
export default Progress;
