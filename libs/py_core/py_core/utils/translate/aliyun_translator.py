from asyncio import to_thread
from time import perf_counter
from typing import Any, Dict, List, Union, Iterable

try:
    from chatlib.utils.integration import (
        IntegrationService,
        APIAuthorizationVariableSpec,
    )
except Exception:
    # Minimal fallbacks for test environments where chatlib is not installed
    class APIAuthorizationVariableSpec:
        def __init__(self, *args, **kwargs):
            pass

    class IntegrationService:
        pass

from py_core.utils.platforms.aliyun import AliyunClient
from alibabacloud_alimt20181012.client import Client as alimt20181012Client
from alibabacloud_alimt20181012 import models as alimt_20181012_models
from alibabacloud_tea_util import models as util_models
from py_core.system.model import UserLocale


class AliyunTranslator(IntegrationService):
    __ak_id = APIAuthorizationVariableSpec(
        variable_type="access_key_id",
        human_readable_type_name="Access Key ID",
        validation_error_message="Aliyun Access Key ID is required.",
    )
    __ak_secret = APIAuthorizationVariableSpec(
        variable_type="access_key_secret",
        human_readable_type_name="Access Key Secret",
        validation_error_message="Aliyun Access Key Secret is required.",
    )
    __client: alimt20181012Client

    @classmethod
    def provider_name(cls) -> str:
        return "AliyunTranslate"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return [cls.__ak_id, cls.__ak_secret]

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, Any]
    ) -> bool:
        if (
            variables[cls.__ak_id] is not None
            and variables[cls.__ak_secret] is not None
        ):
            return True
        else:
            return False

    def __init__(self):
        self.__client = AliyunClient.create_trans_client()

    async def translate_single(
        self,
        text: str,
        user_locale: UserLocale,
        target_lang: str,
        source_lang: str | None = None,
        context: str = "",
    ) -> str:
        translate_general_request = alimt_20181012_models.TranslateGeneralRequest(
            context=context,
            source_language=source_lang if source_lang is not None else "auto",
            target_language=target_lang,
            format_type="text",
            source_text=text,
        )
        runtime = util_models.RuntimeOptions()

        t_start = perf_counter()
        awaitable = await to_thread(
            self.__client.translate_general_with_options_async,
            translate_general_request,
            runtime,
        )
        result = await awaitable
        t_end = perf_counter()

        print(f"Aliyun single translation took {t_end - t_start} sec.")

        if isinstance(result, alimt_20181012_models.TranslateGeneralResponse):
            if result.status_code == 200:
                if isinstance(
                    result.body, alimt_20181012_models.TranslateGeneralResponseBody
                ) and (
                    result.body.code == 200
                    and result.body.data is not None
                    and result.body.data.translated is not None
                ):
                    return result.body.data.translated
                else:
                    return "No translated text found"
            else:
                return f"Failed to translate: {result.status_code} {result.body.message} {result.body.request_id}"
        else:
            return "Failed to run single translation"

    async def translate_batch(
        self,
        text: Iterable[str],
        user_locale: UserLocale,
        target_lang: str,
        source_lang: str | None = None,
        context: str = "",
    ) -> List[str]:
        import json
        enumerated_text = {k: v for k, v in enumerate(text)}
        translate_general_request = alimt_20181012_models.GetBatchTranslateRequest(
            api_type="translate_standard",
            source_language=source_lang if source_lang is not None else "auto",
            target_language=target_lang,
            format_type="text",
            source_text=json.dumps(enumerated_text),
            scene="general",
        )
        runtime = util_models.RuntimeOptions()

        t_start = perf_counter()
        print("Aliyun batch request map:", translate_general_request.to_map())
        try:
            awaitable = await to_thread(
                self.__client.get_batch_translate_with_options_async,
                translate_general_request,
                runtime,
            )
            result = await awaitable
        except Exception:
            print(
                "Aliyun batch translate request failed. Request map:",
                translate_general_request.to_map(),
            )
            raise
        t_end = perf_counter()

        print(f"Aliyun batch translation took {t_end - t_start} sec.")

        if isinstance(result, alimt_20181012_models.GetBatchTranslateResponse):
            if result.status_code != 200:
                return [
                    f"Failed to translate: {result.status_code} {result.body.message} {result.body.request_id}"
                ]

            final_results = list(text)

            body = result.body
            print("Aliyun batch translation response body:", body)
            if (
                isinstance(body, alimt_20181012_models.GetBatchTranslateResponseBody)
                and body.translated_list is not None
            ):
                translate_result: List[Dict[str, Any]] = body.translated_list

                for item in translate_result:
                    # support both dicts and SDK model objects; accept numeric or string codes
                    code_value = None
                    idx = None
                    translated_text = None

                    if isinstance(item, dict):
                        code_value = item.get("code")
                        idx = item.get("index")
                        translated_text = item.get("translated")
                    else:
                        code_value = getattr(item, "code", None)
                        idx = getattr(item, "index", None)
                        translated_text = getattr(item, "translated", None)

                    try:
                        if (
                            code_value is not None
                            and int(code_value) == 200
                            and idx is not None
                            and translated_text is not None
                        ):
                            final_results[int(idx)] = translated_text
                    except Exception:
                        # ignore malformed items
                        continue

            return final_results
        else:
            return ["Failed to run batch translation"]

    async def translate(
        self,
        text: Union[str, Iterable[str]],
        user_locale: UserLocale,
        target_lang: str,
        source_lang: str | None = None,
        context: str = "",
    ) -> Union[str, list[str]]:
        fixed_source_lang = source_lang if source_lang is not None else "auto"
        fixed_source_lang = (
            fixed_source_lang
            if not user_locale == UserLocale.TraditionalChinese
            else "yue"
        )

        print(f"Aliyun Translating from {fixed_source_lang} to {target_lang}: {text}")

        if isinstance(text, str):
            return await self.translate_single(
                text,
                user_locale,
                target_lang,
                fixed_source_lang,
                context,
            )
        else:
            return await self.translate_batch(
                text, user_locale, target_lang, fixed_source_lang, context
            )
