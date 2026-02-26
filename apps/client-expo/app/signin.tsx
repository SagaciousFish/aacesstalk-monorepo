import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Image } from 'expo-image';
import { HillBackgroundView } from '@/components/HillBackgroundView';
import { TailwindButton } from '@/components/ui/TailwindButton';

const LANGS = [
    { code: 'zh', label: '中文' },
    { code: 'yue', label: '廣東話' },
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
];

import i18next from 'i18next';
import { getString, setString } from '@/utils/storage';
import { useTranslation } from 'react-i18next';
import { useFonts } from 'expo-font';

// Tailwind v4 colors (replaced tailwindcss/colors)
const colors = {
    slate: {
        400: '#94a3b8',
        700: '#334155',
    },
};

// Local styleTemplates (simplified from client-rn)
const styleTemplates = {
    withSemiboldFont: { fontFamily: 'NanumSquareNeoTTF-cBd' },
};

export default function SignInScreen() {
    const router = useRouter();
    const [passcode, setPasscode] = useState('');
    const [lang, setLang] = useState(i18next.language ?? 'zh');
    const [langIndex, setLangIndex] = useState(LANGS.findIndex(l => l.code === (i18next.language ?? 'zh')) ?? 0);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const { t } = useTranslation();

    const [isFocused, setIsFocused] = useState(false);
    const { width } = useWindowDimensions();

    // Load the same fonts used by client-rn so the Sign In page matches its style
    const [fontsLoaded] = useFonts({
        'NanumSquareNeoTTF-aLt': require('assets/fonts/NanumSquareNeoTTF-aLt.ttf'),
        'NanumSquareNeoTTF-bRg': require('assets/fonts/NanumSquareNeoTTF-bRg.ttf'),
        'NanumSquareNeoTTF-cBd': require('assets/fonts/NanumSquareNeoTTF-cBd.ttf'),
        'NanumSquareNeoTTF-dEb': require('assets/fonts/NanumSquareNeoTTF-dEb.ttf'),
        'NanumSquareNeoTTF-eHv': require('assets/fonts/NanumSquareNeoTTF-eHv.ttf'),
        'KyoboHandwriting2019': require('assets/fonts/KyoboHandwriting2019.ttf')
    });

    // Always call useEffect to maintain hook order
    useEffect(() => {
        (async () => {
            const saved = await getString('app_language');
            if (saved && saved !== lang) {
                i18next.changeLanguage(saved);
                setLang(saved);
                setLangIndex(LANGS.findIndex(l => l.code === saved) ?? 0);
            }
        })();
    }, [lang]);

    // Show loading while fonts load
    if (!fontsLoaded) {
        return (
            <HillBackgroundView>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText>Loading...</ThemedText>
                </View>
            </HillBackgroundView>
        );
    }

    const cycleLang = async () => {
        const codes = LANGS.map(l => l.code);
        const idx = codes.indexOf(lang || 'zh');
        const next = codes[(idx + 1) % codes.length];
        i18next.changeLanguage(next);
        await setString('app_language', next);
        setLang(next);
        setLangIndex((i) => (i + 1) % LANGS.length);
    };

    const onSubmit = async () => {
        setIsAuthorizing(true);
        try {
            // TODO: wire this to real auth (e.g. dispatch(loginDyadThunk(passcode)))
            await new Promise((r) => setTimeout(r, 800));
            // Navigate to the main tabs (make sure it doesn't redirect back to the Sign In screen)
            router.replace('/(tabs)');
        } catch (e) {
            // show error handling here
        } finally {
            setIsAuthorizing(false);
        }
    };

    const logoWidth = Math.min(350, width * 0.85);
    const logoHeight = (150 / 400) * logoWidth;

    return (
        <HillBackgroundView>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.wrapper}
            >
                <View style={styles.inner}>
                    {/* logo (SVG) */}
                    {/* svgs are declared in project, use SVG if available */}
                    <View style={styles.logoWrap}>
                        {/* Use PNG via expo-image to ensure consistent element type across web/native */}
                        <Image source={require('@/assets/images/logo-extended.png')} style={{ width: logoWidth, height: logoHeight }} contentFit="contain" />
                    </View>

                    {isAuthorizing ? (
                        <ThemedText type="subtitle" style={{ fontFamily: 'NanumSquareNeoTTF-bRg' }}>{t('SignIn.Authorizing')}</ThemedText>
                    ) : (
                        <>
                            <TextInput
                                placeholder={t('SignIn.InsertNumber')}
                                placeholderTextColor={colors.slate[400]}
                                style={[styles.passcode, isFocused ? styles.passcodeFocused : null, styleTemplates.withSemiboldFont]}
                                value={passcode}
                                onChangeText={setPasscode}
                                textAlign="center"
                                keyboardType="numeric"
                                returnKeyType="go"
                                onSubmitEditing={onSubmit}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />
                            <TailwindButton title={t('SignIn.SignIn')} onPress={onSubmit} disabled={!passcode} containerStyle={{ marginTop: 12, width: '100%' }} titleStyle={{ fontFamily: 'NanumSquareNeoTTF-bRg' }} />
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>

            <Pressable onPress={cycleLang} style={styles.langButton}>
                <ThemedText style={[styleTemplates.withSemiboldFont, { color: colors.slate[700], fontSize: 14 }]}>{LANGS[langIndex].label}</ThemedText>
            </Pressable>
        </HillBackgroundView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 200,
    },
    inner: {
        width: '84%',
        alignItems: 'center',
        gap: 16,
    },
    logoWrap: {
        marginBottom: 12,
        alignItems: 'center'
    },
    passcode: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: Platform.OS === 'android' ? 14 : 10,
        paddingHorizontal: 12,
        fontSize: 20,
        textAlign: 'center',
        borderWidth: 2,
        borderColor: '#11111345',
        marginTop: 16,
        fontWeight: '600',
        fontFamily: 'NanumSquareNeoTTF-cBd'
    },
    passcodeFocused: {
        borderColor: '#14b8a6',
        borderWidth: 3
    },

    langButton: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
});
