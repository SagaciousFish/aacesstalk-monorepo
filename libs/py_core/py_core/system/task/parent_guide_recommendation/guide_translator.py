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
        guide_texts = [entry.guide for entry in guides] if isinstance(guides, list) else guides.guide

        ##translated_examples, translated_guides = await asyncio.gather(coroutine_translate_examples, coroutine_translate_guides)
        translated_guides = await self.__translator.translate(
            text=guide_texts,
            user_locale=user_locale,
            target_lang=user_locale,
            context="The phrases are guides for parents' communication with children with Autism Spectrum Disorder. The sentences should be translated into casual lanauge so parents can easily understand and use them.",
        )

        return [entry.with_guide_localized(guide) for guide, entry in zip(translated_guides, guides)] if isinstance(guides, list) else guides.with_guide_localized(translated_guides)
