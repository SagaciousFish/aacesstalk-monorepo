import { initializeI18n } from "@aacesstalk/libs/ts-core";
import { initReactI18next } from "react-i18next";
import { MMKV } from "react-native-mmkv";

import * as RNLocalize from 'react-native-localize';
const storage = new MMKV();
const savedLang = storage.getString('app_language') ?? undefined;
const locales = RNLocalize.getLocales();
const defaultLang = savedLang ?? locales?.[0]?.languageCode ?? 'zh';

initializeI18n(defaultLang, {
    resources: {
        yue: { translation: require('./translations/yue') },
        zh: { translation: require('./translations/zh') },
        ko: { translation: require('./translations/ko') },
        en: { translation: require("./translations/en") }
    },
    middlewares: [initReactI18next]
})