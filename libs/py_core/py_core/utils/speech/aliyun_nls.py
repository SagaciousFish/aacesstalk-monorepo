import asyncio
from dataclasses import dataclass
import os
from time import time, sleep
from typing import Any, BinaryIO
from chatlib.utils.integration import (
    APIAuthorizationVariableSpec,
    APIAuthorizationVariableSpecPresets,
    IntegrationService,
)
import httpx
from py_core.utils.speech.speech_recognizer_base import SpeechRecognizerBase
import json

import dotenv

import nls

from py_core.system.model import UserLocale

from timeit import default_timer as timer

REGION = "cn-shanghai"
URL = f"wss://nls-gateway-{REGION}.aliyuncs.com/ws/v1"


@dataclass
class TokenGetter:
    @dataclass
    class Token:
        token: str = ""
        expire_time: int = 0

    _token: Token | None = None

    def get_token(self) -> str:
        if TokenGetter._token is not None and TokenGetter._token.expire_time > time():
            return TokenGetter._token.token

        from aliyunsdkcore.client import AcsClient
        from aliyunsdkcore.request import CommonRequest

        # Get token from Aliyun NLS service
        dotenv.load_dotenv()
        access_key_id = os.environ["ALIBABA_CLOUD_ACCESS_KEY_ID"]
        access_key_secret = os.environ["ALIBABA_CLOUD_ACCESS_KEY_SECRET"]

        client = AcsClient(access_key_id, access_key_secret, REGION)

        request = CommonRequest()
        request.set_method("POST")
        request.set_domain("nls-meta.cn-shanghai.aliyuncs.com")
        request.set_version("2019-02-28")
        request.set_action_name("CreateToken")

        try:
            response = client.do_action_with_exception(request)
            print(response)
            if response is None:
                return ""
            jss = json.loads(response)
            if "Token" in jss and "Id" in jss["Token"]:
                token = jss["Token"]["Id"]
                expireTime = jss["Token"]["ExpireTime"]
                print("token = " + token)
                print("expireTime = " + str(expireTime))
                TokenGetter._token = TokenGetter.Token(
                    token=token, expire_time=expireTime
                )
                return token
        except Exception as e:
            print(e)
        return ""


class AsyncTestSr:
    """Async-friendly wrapper around the blocking NlsSpeechRecognizer usage.

    The recognizer and audio sending run in a thread via ``asyncio.to_thread``
    so the caller can `await start()` without blocking the event loop.
    """

    def __init__(self, tid, locale, test_file):
        self.__id = tid
        self.__locale = locale
        self.__test_file = test_file
        self.__data = b""
        self.__result = ""

    async def loadfile(
        self, source: str | os.PathLike | bytes | bytearray | memoryview | BinaryIO
    ):
        """Load audio data from a path, bytes, memoryview, or file-like object."""

        def _read_fileobj(f: BinaryIO) -> bytes:
            pos = f.tell()
            f.seek(0)
            data = f.read()
            f.seek(pos)
            return data

        loop = asyncio.get_running_loop()

        if isinstance(source, (str, os.PathLike)):
            self.__data = await loop.run_in_executor(
                None, lambda: open(source, "rb").read()
            )
        elif isinstance(source, (bytes, bytearray)):
            self.__data = bytes(source)
        elif isinstance(source, memoryview):
            self.__data = source.tobytes()
        elif hasattr(source, "read"):
            # Only pass to _read_fileobj if it's a BinaryIO, not memoryview
            self.__data = await loop.run_in_executor(
                None, lambda: _read_fileobj(source)
            )
        else:
            raise TypeError("Unsupported audio source type")

    def parse_result(self, result: str) -> str:
        """Parse the result string from Aliyun NLS and return the recognized text."""
        try:
            result_json = json.loads(result)
            if (
                "header" in result_json
                and "status" in result_json["header"]
                and result_json["header"]["status"] == 20000000
            ):
                return result_json.get("payload", {}).get("result", "")
            else:
                return "failed to recognize with error code {}".format(
                    result_json["header"]["status"]
                )
        except Exception:
            return "invalid result format"

    async def start(self):
        await self.loadfile(self.__test_file)
        await asyncio.to_thread(self._run_blocking)
        return self.parse_result(self.__result)

    def test_on_start(self, message, *args):
        print("test_on_start:{}".format(message))

    def test_on_error(self, message, *args):
        print("on_error args=>{}".format(args))

    def test_on_close(self, *args):
        print("on_close: args=>{}".format(args))

    def test_on_result_chg(self, message, *args):
        print("test_on_chg:{}".format(message))

    def test_on_completed(self, message, *args):
        print("on_completed:args=>{} message=>{}".format(args, message))
        self.__result = message

    def _run_blocking(self):
        """Blocking part: create recognizer, stream audio, stop.

        This runs in a separate thread so it doesn't block the event loop.
        """
        print("thread:{} start..".format(self.__id))

        sr = nls.NlsSpeechRecognizer(
            url=URL,
            token=TokenGetter().get_token(),
            appkey=(
                os.environ["ALIYUN_NLS_YUE_APP_KEY"]
                if self.__locale == UserLocale.TraditionalChinese
                else os.environ["ALIYUN_NLS_ZH_EN_APP_KEY"]
            ),
            on_start=self.test_on_start,
            on_result_changed=self.test_on_result_chg,
            on_completed=self.test_on_completed,
            on_error=self.test_on_error,
            on_close=self.test_on_close,
            callback_args=[self.__id],
        )

        print("{}: session start".format(self.__id))
        r = sr.start(aformat="wav", ex={"hello": 123})

        # stream audio in 640-byte frames
        data = self.__data or b""
        for i in range(0, len(data), 640):
            chunk = data[i : i + 640]
            if not chunk:
                break
            sr.send_audio(chunk)
            sleep(0.01)

        r = sr.stop()
        print("{}: sr stopped:{}".format(self.__id, r))
        sleep(1)


class AliyunSpeechRecognizer(SpeechRecognizerBase, IntegrationService):
    # default_value="wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1",

    @classmethod
    def provider_name(cls) -> str:
        return "aliyun_nls"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, Any]
    ) -> bool:
        return True

    async def recognize_speech(
        self,
        file_name: str,
        file,
        content_type: str = "",
        locale: UserLocale = UserLocale.SimplifiedChinese,
        child_name: str = "",
    ) -> str:
        recognizer = AsyncTestSr(
            tid=child_name,
            locale=locale,
            test_file=file,
        )
        result = await recognizer.start()
        return result
