import 'intl-pluralrules';
import i18next from "i18next";
import merge from 'merge';

export function initializeI18n(defaultLanguage: string = "zh",
    options: {
        middlewares?: Array<any>,
        resources?: { [locale: string]: any }
    } | undefined = undefined) {
    let i18nInstance = i18next

    if (options?.middlewares != null && options.middlewares.length > 0) {
        for (const middleware of options.middlewares) {
            i18nInstance = i18nInstance.use(middleware)
        }
    }

    i18nInstance.init({
        fallbackLng: 'zh',
        lng: defaultLanguage,
        resources: merge.recursive(false, {
            yue: {
                translation: require("./translations/yue")
            },
            zh: {
                translation: require("./translations/zh")
            },
            ko: {
                translation: require("./translations/ko")
            },
            en: {
                translation: require("./translations/en")
            }
        }, options?.resources),
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