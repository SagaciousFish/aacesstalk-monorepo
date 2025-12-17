import { initializeI18n } from "@aacesstalk/libs/ts-core";
import { initReactI18next } from "react-i18next";

initializeI18n("zh", {
    resources: {
        yue: { translation: require('./translations/yue') },
        zh: { translation: require('./translations/zh') },
        ko: { translation: require('./translations/ko') },
        en: { translation: require("./translations/en") }
    },
    middlewares: [initReactI18next]
})