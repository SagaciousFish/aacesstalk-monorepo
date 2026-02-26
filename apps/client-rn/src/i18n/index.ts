import { initializeI18n } from "@aacesstalk/libs/ts-core";
import { initReactI18next } from "react-i18next";
import { MMKV } from "react-native-mmkv";

import * as RNLocalize from 'react-native-localize';

// Get saved language or detect from device - with fallback for web
let defaultLang = 'zh';
try {
    const storage = new MMKV();
    const savedLang = storage.getString('app_language');
    if (savedLang) {
        defaultLang = savedLang;
    } else {
        const locales = RNLocalize.getLocales();
        defaultLang = locales?.[0]?.languageCode ?? 'zh';
    }
} catch (e) {
    // Web environment or initialization failed - use default
    console.warn('i18n: Failed to load saved language, using default:', e);
}

initializeI18n(defaultLang, {
    resources: {
        yue: { translation: require('./translations/yue') },
        zh: { translation: require('./translations/zh') },
        ko: { translation: require('./translations/ko') },
        en: { translation: require("./translations/en") }
    },
    middlewares: [initReactI18next]
})