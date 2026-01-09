import os

# from alibabacloud_bailian20231229.client import Client as bailian20231229Client
# from alibabacloud_bailian20231229 import models as bailian_20231229_models
from alibabacloud_tea_openapi import models as open_api_models
from py_core.system.model import UserLocale
import re

from chatlib.llm.integration import GPTChatCompletionAPI, ChatGPTModel
from chatlib.tool.versatile_mapper import (
    ChatCompletionFewShotMapper,
    ChatCompletionFewShotMapperParams,
    MapperInputOutputPair,
)
from chatlib.utils.jinja_utils import convert_to_jinja_template
from time import perf_counter

from py_core.config import AACessTalkConfig
from py_core.system.task.parent_guide_recommendation.common import (
    ParentGuideRecommendationAPIResult,
)
from py_core.utils.lookup_translator import LookupTranslator
from py_core.utils.models import DictionaryRow
from py_core.utils.vector_db import VectorDB

template = convert_to_jinja_template("""You are a helpful translator who translates an utterance of a parent talking with their child with ASD.
[Task]
- Translate the following English message to {{ user_locale }}.
- Note that the messages are intended to be spoken by a parent to a child.
- Reflect the cultural and linguistic characteristics of {{ user_locale }} in the translation.
- Keep the meaning of the original message as much as possible.
""")


def _generate_prompt(input, params) -> str:
    # Prefer explicit user_locale on params (set by callers), then fall back to api_params dict or attributes
    user_locale = getattr(params, "user_locale", None)
    if user_locale is None:
        api_params = getattr(params, "api_params", None)
        user_locale = "SimplifiedChinese"
        if api_params is not None:
            if isinstance(api_params, dict):
                user_locale = api_params.get("user_locale", "SimplifiedChinese")
            else:
                # api_params may be an object (e.g., ChatCompletionParams). Try attribute access.
                user_locale = (
                    getattr(api_params, "user_locale", None)
                    or getattr(api_params, "userLocale", None)
                    or "SimplifiedChinese"
                )

    r = template.render(user_locale=user_locale)
    return r


class ParentExampleMessageTranslator:
    def __init__(self, vector_db: VectorDB | None):
        api = GPTChatCompletionAPI()
        api.config().verbose = False

        self.__dictionary = LookupTranslator(
            "parent_examples",
            AACessTalkConfig.parent_example_translation_dictionary_path,
            vector_db=vector_db or VectorDB(),
            verbose=True,
        )

        self.__example_translator: ChatCompletionFewShotMapper[
            str, str, ChatCompletionFewShotMapperParams
        ] = ChatCompletionFewShotMapper.make_str_mapper(
            api, instruction_generator=_generate_prompt
        )

    async def translate_example(
        self, original_message: str, locale: UserLocale = UserLocale.SimplifiedChinese
    ) -> str:
        if locale == UserLocale.English:
            return original_message

        t_start = perf_counter()

        samples = self.__dictionary.query_similar_rows(original_message, None, k=3)

        samples_formatted = [
            MapperInputOutputPair(input=sample.english, output=sample.localized) for sample in samples
        ]

        # Build params for the mapper and attach the locale explicitly on the params object
        from typing import Any, cast

        params = ChatCompletionFewShotMapperParams(
            model="qwen3-max", api_params=cast(Any, {})
        )

        # Attach locale to params so instruction generator can access it (ChatCompletionParams doesn't accept arbitrary fields)
        try:
            params.__dict__["user_locale"] = locale.value
        except Exception:
            try:
                object.__setattr__(params, "user_locale", locale.value)
            except Exception:
                pass

        try:
            result = await self.__example_translator.run(
                samples_formatted, original_message, params
            )
        except Exception as e:
            print(f"LLM translation failed: {e}")
            return original_message

        t_end = perf_counter()

        print(
            f"LLM translation took {t_end - t_start} sec. Original: {original_message} Translated: {result}"
        )

        return result
