from py_core.system.model import ParentGuideElement, UserLocale
from py_core.utils.translate.aliyun_translator import AliyunTranslator


class GuideTranslator:
    def __init__(self):
        self.__translator = AliyunTranslator()

    async def translate(
        self,
        guides: list[ParentGuideElement] | ParentGuideElement,
        user_locale: UserLocale = UserLocale.SimplifiedChinese,
    ) -> list[ParentGuideElement]:
        guide_texts = (
            [entry.guide for entry in guides]
            if isinstance(guides, list)
            else guides.guide
        )

        # Ensure we pass a simple language code string to the translator
        target_lang = (
            user_locale.value if hasattr(user_locale, "value") else str(user_locale)
        )

        print(f"Translating guides to {target_lang}. Input texts: {guide_texts}")

        translated_guides = await self.__translator.translate(
            text=guide_texts,
            user_locale=user_locale,
            source_lang="en",
            target_lang=target_lang,
            context="The phrases are guides for parents' communication with children with Autism Spectrum Disorder. The sentences should be translated into casual lanauge so parents can easily understand and use them.",
        )

        print(f"Translation result: {translated_guides}")

        # Normalize result: always return a list of localized strings matching the input guides
        if isinstance(guides, list):
            if not isinstance(translated_guides, list) or len(translated_guides) != len(
                guides
            ):
                print(
                    "Warning: translated result length mismatch or unexpected type. Falling back to original guide texts for localization."
                )
                translated_guides_list = [g.guide for g in guides]
            else:
                translated_guides_list = translated_guides

            return [
                entry.with_guide_localized(guide_localized)
                for guide_localized, entry in zip(translated_guides_list, guides)
            ]
        else:
            if isinstance(translated_guides, list):
                translated_text = (
                    translated_guides[0] if len(translated_guides) > 0 else guides.guide
                )
            else:
                translated_text = translated_guides
            return guides.with_guide_localized(translated_text)
