import { initReactI18next } from "react-i18next";

import * as Localization from 'expo-localization';
import i18next from 'i18next';
import deepmerge from 'deepmerge';
import { getString } from '@/utils/storage';

const localeStr = Localization.locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'zh');
const locales = [{ languageCode: (localeStr || 'zh').split(/[-_]/)[0] }];
const defaultLang = locales?.[0]?.languageCode ?? 'zh';

export function initializeI18n(defaultLanguage: string = "zh",
    options?: {
        middlewares?: Array<any>,
        resources?: { [locale: string]: any }
    }) {
    let i18nInstance = i18next;

    if (options?.middlewares != null && options.middlewares.length > 0) {
        for (const middleware of options.middlewares) {
            i18nInstance = i18nInstance.use(middleware)
        }
    }

    i18nInstance.init({
        fallbackLng: 'zh',
        lng: defaultLanguage,
        resources: deepmerge({
            yue: {
                translation: require("./translations/libs/yue")
            },
            zh: {
                translation: require("./translations/libs/zh")
            },
            zht: {
                translation: require("./translations/libs/zht")
            },
            ko: {
                translation: require("./translations/libs/ko")
            },
            en: {
                translation: require("./translations/libs/en")
            }
        }, options?.resources || {}),
        react: {
            useSuspense: true
        },
        debug: false
    }, (err, t) => {
        if (err) {
            console.log("Error on initializing i18n - ", err)
        } else {
            console.log("Successfully initialized i18n module.")
        }
    })
}

console.log('initializeI18n type before call:', typeof initializeI18n, initializeI18n);
try {
    initializeI18n(defaultLang, {
        resources: {
            yue: { translation: require('./translations/yue') },
            zh: { translation: require('./translations/zh') },
            zht: { translation: require('./translations/zht') },
            ko: { translation: require('./translations/ko') },
            en: { translation: require("./translations/en") }
        },
        middlewares: [initReactI18next]
    })
} catch (e) {
    console.error('initializeI18n call failed:', e);
}

// If a saved language exists in storage, apply it asynchronously (avoids requiring native modules at import time)
(async () => {
    try {
        const saved = await getString('app_language');
        if (saved) {
            i18next.changeLanguage(saved);
        }
    } catch (e) {
        // ignore
    }
})();