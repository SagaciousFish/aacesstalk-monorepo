import { CardCategory, CardImageMatching, CardInfo, Http, TopicCategory, appendCard, childCardSessionSelectors } from "@aacesstalk/libs/ts-core"
import { useDispatch, useSelector } from "apps/client-rn/src/redux/hooks"
import { CardImageManager } from "apps/client-rn/src/services/card-image"
import { VoiceOverManager } from "apps/client-rn/src/services/voiceover"
import { getTopicColorClassNames, styleTemplates } from "apps/client-rn/src/styles"
import { useNonNullUpdatedValue } from "apps/client-rn/src/utils/hooks"
import React, { useEffect, useState } from "react"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { Easing, FlipInYLeft, FlipOutEasyY, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import MeasuredImage from 'apps/client-rn/src/components/MeasuredImage';
import type { ImageOptions } from '@candlefinance/faster-image';


const styles = StyleSheet.create({
    cardFrame: {
        shadowColor: "rgba(10,10,10)",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 5 },
        shadowRadius: 2.6,
        elevation: 4,
    },
    imageView: { aspectRatio: 1, flex: 1, alignSelf: 'center', borderRadius: 8, overflow: 'hidden' }
})

export const CardCategoryView = (props: {
    topicCategory: TopicCategory,
    cardCategory: CardCategory,
    style?: any,
}) => {
    const { t } = useTranslation()

    const [_, lightTopicColor] = useMemo(() => getTopicColorClassNames(props.topicCategory), [props.topicCategory])

    const cardIds = useSelector(childCardSessionSelectors[props.cardCategory].selectIds)
    const cardEntities = useSelector(childCardSessionSelectors[props.cardCategory].selectEntities)

    const slicedCardIds = useMemo(() => {
        const result: Array<Array<string>> = []
        for (let i = 0; i < cardIds.length; i += 2) {
            result.push(cardIds.slice(i, i + 2))
        }
        return result
    }, [cardIds])

    return <View className={`${lightTopicColor} rounded-2xl p-2`} style={props.style}>
        <Text style={styleTemplates.withBoldFont} className="text-lg text-center">{t(`Session.Cards.Category.${props.cardCategory}`)}</Text>


        {
            slicedCardIds.map((row, rowIndex) => <View key={rowIndex} className="flex-row">{
                row.map((id, index) => {
                    const actualIndex = rowIndex * 2 + index
                    return <Animated.View
                        key={id}
                        entering={FlipInYLeft.duration(300).easing(Easing.elastic(0.7)).delay(50 * actualIndex)}
                        exiting={FlipOutEasyY.duration(150).delay(30 * actualIndex)}>
                        <TopicChildCardView id={id} category={props.cardCategory} />
                    </Animated.View>
                })
            }</View>)
        }
    </View>
}

export const TopicChildCardView = React.memo((props: {
    category: CardCategory,
    id: string,
    cardClassName?: string
}) => {
    const dispatch = useDispatch()

    const cardInfo = useNonNullUpdatedValue(useSelector(state => childCardSessionSelectors[props.category].selectById(state, props.id)))
    const isProcessing = useSelector(state => state.session.isProcessingRecommendation)

    const token = useSelector(state => state.auth.jwt)

    const onPress = useCallback(async () => {
        dispatch(appendCard(cardInfo))
        // Play voice over
        await VoiceOverManager.instance.placeVoiceoverFetchTask(cardInfo, token)
    }, [cardInfo, token])

    return <ChildCardView disabled={isProcessing} imageQueryId={props.id} label={cardInfo?.label_localized || cardInfo?.label} cardClassName={props.cardClassName} onPress={onPress} />
})

export const ChildCardView = React.memo((props: {
    label: string,
    imageQueryId?: string,
    disabled?: boolean,
    onPress?: () => void,
    cardClassName?: string
}) => {

    const token = useSelector(state => state.auth.jwt)

    const pressAnimProgress = useSharedValue(0)

    const onPressIn = useCallback(() => {
        pressAnimProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    }, [])

    const onPressOut = useCallback(() => {
        pressAnimProgress.value = withSpring(0, { duration: 500 })
    }, [])

    const cardFrameAnimStyle = useAnimatedStyle(() => {
        const isAndroid = Platform.OS === 'android';
        const shadowStyle = !isAndroid ? {
            ...styles.cardFrame,
            shadowOffset: { width: 0, height: interpolate(pressAnimProgress.value, [0, 1], [styles.cardFrame.shadowOffset.height, 2]) },
            shadowRadius: interpolate(pressAnimProgress.value, [0, 1], [styles.cardFrame.shadowRadius, 1]),
        } : {
            elevation: interpolate(pressAnimProgress.value, [0, 1], [styles.cardFrame.elevation, 1]),
        }

        return {
            ...shadowStyle,
            transform: [
                { scale: interpolate(pressAnimProgress.value, [0, 1], [1, 0.95]) },
                { translateY: interpolate(pressAnimProgress.value, [0, 1], [0, 10]) }
            ] as any
        }
    }, [])

    const onPress = useCallback(() => {
        props.onPress?.()
    }, [props.onPress])

    const [imageSource, setImageSource] = useState<ImageOptions>(undefined)

    const applyCardImage = useCallback(async (matching: CardImageMatching) => {
        // First try to use a cached image source provided by CardImageManager to avoid repeated header requests
        const cached = CardImageManager.instance.getCachedImageSource(props.imageQueryId)
        if (cached) {
            setImageSource({ headers: cached.headers, url: cached.url } as ImageOptions)
            return
        }

        // Fallback: fetch signed headers and construct the image source
        const headers = { ...(await Http.getSignedInHeaders(token)), Accept: 'image/webp,image/*,*/*' }

        setImageSource({
            headers,
            url: Http.axios.defaults.baseURL + Http.ENDPOINT_DYAD_MEDIA_CARD_IMAGE + "?card_type=" + matching.type + "&image_id=" + matching.image_id,
        } as ImageOptions)
    }, [token, props.imageQueryId])

    useEffect(() => {
        let sub: any = undefined
        if (props.imageQueryId) {
            const cached = CardImageManager.instance.getCachedMatching(props.imageQueryId)
            if (cached) {
                applyCardImage(cached)
            }

            sub = CardImageManager.instance.subscribeToImageMatching(props.imageQueryId, applyCardImage)
        }

        return () => {
            try { sub?.unsubscribe?.() } catch (e) { /* noop */ }
        }
    }, [props.imageQueryId, applyCardImage])

    return <Pressable accessible={false} disabled={props.disabled} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}><Animated.View
        style={cardFrameAnimStyle} className={`rounded-xl border-2 border-slate-200 pt-2 pb-2 bg-white w-[11vw] h-[11vw] m-1.5 ${props.cardClassName}`}>
        <MeasuredImage style={styles.imageView} source={imageSource} />

        <Text includeFontPadding={true} allowFontScaling={true} numberOfLines={2} className="self-center mt-2 text-black/80 text-center" style={[styleTemplates.withBoldFont, { lineHeight: 18, paddingVertical: 1 }]}>{props.label}</Text>
    </Animated.View></Pressable>
})