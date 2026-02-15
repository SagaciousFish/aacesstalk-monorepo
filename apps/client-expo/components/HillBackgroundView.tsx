import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Reanimated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { Image } from 'expo-image';
import { PropsWithChildren, useEffect } from 'react';

export const HillBackgroundView = (props: PropsWithChildren<{ containerStyle?: any, hillImageWidth?: number, hillImageHeight?: number }>) => {
    const { width } = useWindowDimensions();
    const hillHeight = (props.hillImageHeight || 255) / (props.hillImageWidth || 1194) * width;

    const Hill = require('@/assets/images/hill-normal.svg');
    const Cloud1 = require('@/assets/images/cloud-1.svg');
    const Cloud2 = require('@/assets/images/cloud-2.svg');

    const cloud1PositionCycle = useSharedValue(0);
    const cloud2PositionCycle = useSharedValue(0);
    const cloud3PositionCycle = useSharedValue(0);

    const cloud1Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud1,
            transform: [{ translateX: interpolate(cloud1PositionCycle.value, [0, 1], [0, width]) }]
        }
    }, [width])

    const cloud1_1Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud1,
            transform: [{ translateX: interpolate(cloud1PositionCycle.value, [0, 1], [-width, 0]) }]
        }
    }, [width])

    const cloud2Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud2,
            transform: [{ translateX: interpolate(cloud2PositionCycle.value, [0, 1], [0, width]) }]
        }
    }, [width])

    const cloud2_1Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud2,
            transform: [{ translateX: interpolate(cloud2PositionCycle.value, [0, 1], [-width, 0]) }]
        }
    }, [width])


    const cloud3Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud3,
            transform: [
                { translateX: interpolate(cloud3PositionCycle.value, [0, 1], [0, width]) },
            ]
        }
    }, [width])

    const cloud3_1Style = useAnimatedStyle(() => {
        return {
            ...styles.cloud3,
            transform: [
                { translateX: interpolate(cloud3PositionCycle.value, [0, 1], [-width, 0]) },
            ]
        }
    }, [width])

    useEffect(() => {
        cloud1PositionCycle.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false)

        cloud2PositionCycle.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false)

        cloud3PositionCycle.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, false)
    }, [width])

    const scale = width / 1194;
    const cloud1W = Math.max(120, 344 * scale);
    const cloud1H = Math.max(80, 230 * scale);
    const cloud2W = Math.max(80, 213 * scale);
    const cloud2H = Math.max(60, 146 * scale);
    const cloud3W = Math.max(200, 600 * scale);
    const cloud3H = Math.max(150, 500 * scale);

    return (
        <View style={[styles.container, props.containerStyle]}>
            <Image source={Hill} style={[styles.hill, { width, height: hillHeight }]} contentFit="cover" />

            <Reanimated.View style={cloud1Style} pointerEvents="none">
                <Image source={Cloud1} style={{ width: cloud1W, height: cloud1H }} contentFit="contain" />
            </Reanimated.View>
            <Reanimated.View style={cloud1_1Style} pointerEvents="none">
                <Image source={Cloud1} style={{ width: cloud1W, height: cloud1H }} contentFit="contain" />
            </Reanimated.View>
            <Reanimated.View style={cloud2Style} pointerEvents="none">
                <Image source={Cloud2} style={{ width: cloud2W, height: cloud2H }} contentFit="contain" />
            </Reanimated.View>

            <Reanimated.View style={cloud2_1Style} pointerEvents="none">
                <Image source={Cloud2} style={{ width: cloud2W, height: cloud2H }} contentFit="contain" />
            </Reanimated.View>


            <Reanimated.View style={cloud3Style} pointerEvents="none">
                <Image source={Cloud1} style={{ width: cloud3W, height: cloud3H }} contentFit="contain" />
            </Reanimated.View>

            <Reanimated.View style={cloud3_1Style} pointerEvents="none">
                <Image source={Cloud1} style={{ width: cloud3W, height: cloud3H }} contentFit="contain" />
            </Reanimated.View>

            {props.children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDFAFF',
    },
    hill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
    },
    cloud1: {
        position: 'absolute',
        right: 50,
        top: '40%'
    },
    cloud2: {
        position: 'absolute',
        left: 40,
        top: '20%'
    },
    cloud3: {
        position: 'absolute',
        opacity: 0.7,
        left: '45%',
        top: '-50%'
    }
});
