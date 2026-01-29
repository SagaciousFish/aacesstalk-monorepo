import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

export function HelloWave() {
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const wave = () => {
    // Run a short sequence of rotations to create a waving effect
    rotation.value = withRepeat(
      withSequence(
        withTiming(25, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(-25, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) })
      ),
      1,
      false
    );

    console.log('Hello wave!');
  };

  return (
    <Pressable onPress={wave} accessibilityRole="button" accessibilityLabel="Wave hello">
      <Animated.Text style={[{ fontSize: 28, lineHeight: 32, marginTop: -6 }, animatedStyle]}>
        👋
      </Animated.Text>
    </Pressable>
  );
}
