import { useTranslation } from "react-i18next"
import { View, Text, TextInput, Platform } from "react-native"
import LogoImage from '../../../assets/images/logo-extended.svg'
import { styleTemplates } from "apps/client-rn/src/styles"
import { HillBackgroundView } from "apps/client-rn/src/components/HillBackgroundView"
import colors from "tailwindcss/colors"
import { TailwindButton } from "apps/client-rn/src/components/tailwind-components"
import { Control, Controller, useController, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import React, { Fragment, useMemo, useState, useEffect } from "react"
import { i18n } from "@aacesstalk/libs/ts-core";
import { MMKV } from "react-native-mmkv";
import { TouchableOpacity } from "react-native";
import { useDispatch, useSelector } from "apps/client-rn/src/redux/hooks"
import { loginDyadThunk } from "@aacesstalk/libs/ts-core"
import { twMerge } from "tailwind-merge"

const isAndroid = Platform.OS === 'android';
const passcodeInputClassName = twMerge("mt-4 text-xl text-center bg-white rounded-xl border-[#11111345] border-2 focus:border-teal-500 focus:border-[3px]", (isAndroid ? "py-3" : "pt-2.5 pb-3.5"))

const PasscodeInput = (props: {
    control: Control,
    name: string,
    onSubmit?: () => void
}) => {

    const { field, fieldState: { error, invalid } } = useController(props)

    const { t } = useTranslation()

    return <TextInput
        placeholder={t("SignIn.InsertNumber")}
        placeholderTextColor={colors.slate[400]}
        style={styleTemplates.withSemiboldFont}
        textAlign="center"
        multiline={true}
        numberOfLines={1}
        className={passcodeInputClassName}
        // keyboardType="numeric"
        // inputMode="numeric"
        autoCapitalize="none"
        autoComplete="off"
        // secureTextEntry={true}
        ref={field.ref}
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        onSubmitEditing={props.onSubmit}
        returnKeyType="go"
    />

    // return <Controller
    //     control={props.control}
    //     name="passcode"
    //     render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
    //         <View>
    //             <TextInput
    //                 placeholder={t("SignIn.InsertNumber")}
    //                 placeholderTextColor={colors.slate[400]}
    //                 style={styleTemplates.withSemiboldFont}
    //                 textAlign="center"
    //                 className={twMerge(passcodeInputClassName, error && "border-red-500")}
    //                 autoCapitalize="none"
    //                 autoComplete="off"
    //                 autoCorrect={false}
    //                 // secureTextEntry={true}
    //                 textContentType="oneTimeCode"
    //                 value={value}
    //                 onChangeText={onChange}
    //                 onBlur={onBlur}
    //                 onSubmitEditing={props.onSubmit}
    //                 returnKeyType="go"
    //             />
    //             {error && (
    //                 <Text className="text-red-500 text-sm mt-1 text-center">
    //                     {error.message}
    //                 </Text>
    //             )}
    //         </View>
    //     )}
    // />
}

export const SignInScreen = () => {

    const { t } = useTranslation()

    const isAuthorizing = useSelector(state => state.auth.isAuthorizing)
    const authorizationError = useSelector(state => state.auth.error)

    const storage = new MMKV();
    const LANGS = [
        { code: 'zh', label: '中文' },
        { code: 'yue', label: '廣東話' },
        { code: 'ko', label: '한국어' },
        { code: 'en', label: 'English' }
    ];
    const [lang, setLang] = useState(i18n.language ?? 'zh');
    useEffect(() => {
        const saved = storage.getString('app_language');
        if (saved && saved !== lang) {
            i18n.changeLanguage(saved);
            setLang(saved);
        }
    }, []);
    const cycleLang = () => {
        const codes = LANGS.map(l => l.code);
        const idx = codes.indexOf(lang);
        const next = codes[(idx + 1) % codes.length];
        i18n.changeLanguage(next);
        storage.set('app_language', next);
        setLang(next);
    };

    const dispatch = useDispatch()

    const schema = useMemo(() => yup.object({
        passcode: yup.string().min(1).required()
    }), [])

    const { control, handleSubmit, setFocus, formState: { isValid, errors }, setError } = useForm({
        resolver: yupResolver(schema)
    })

    const onSubmit = useMemo(() => handleSubmit(async (values) => {
        dispatch(loginDyadThunk(values.passcode))
    }), [])

    return <HillBackgroundView containerClassName="items-center justify-center pb-[200px]">
        <View className="items-center w-full px-8">
            <LogoImage className="justify-self-center" width={400} height={150} />
            {
                isAuthorizing === true ? <Text className="text-center text-lg text-slate-500" style={styleTemplates.withBoldFont}>{t("SignIn.Authorizing")}</Text> : <Fragment>
                    {
                        authorizationError ? <Text className="text-center text-lg text-red-400 mt-4" style={styleTemplates.withBoldFont}>{t(`SignIn.Errors.${authorizationError}`)}</Text> : null
                    }
                    <PasscodeInput control={control} name="passcode" onSubmit={onSubmit} />
                    <TailwindButton title={t("SignIn.SignIn")} containerClassName="mt-5" roundedClassName={"rounded-full"}
                        titleClassName="text-white"
                        rippleColor="#f0f0f080"
                        disabled={!isValid}
                        disabledButtonStyleClassName="bg-[#e0e0e0]"
                        buttonStyleClassName="bg-[#f9aa33]"
                        onPress={onSubmit}
                    />
                </Fragment>
            }

        </View>
        <TouchableOpacity onPress={cycleLang} className="absolute right-4 bottom-4 bg-white rounded-full px-3 py-2 shadow">
            <Text className="text-sm text-slate-700" style={styleTemplates.withSemiboldFont}>
                {LANGS.find(l => l.code === lang)?.label}
            </Text>
        </TouchableOpacity>
    </HillBackgroundView>
}