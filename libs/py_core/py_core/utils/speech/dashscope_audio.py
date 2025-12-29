from http import HTTPStatus
from dashscope.audio.qwen_omni.omni_realtime import TranscriptionParams
import pathlib
import base64
from dashscope.audio.qwen_omni import OmniRealtimeCallback, OmniRealtimeConversation, MultiModality
import json

from py_core.utils.speech.speech_recognizer_base import SpeechRecognizerBase
import aiofiles
import httpx
from dashscope.audio.asr import Recognition, RecognitionCallback, Transcription
from dashscope.api_entities.dashscope_response import (
    MultiModalConversationOutput,
    MultiModalConversationResponse,
    Audio,
)
import asyncio
import os
from time import time
import atexit
import signal
from chatlib.utils.integration import (
    APIAuthorizationVariableSpec,
    IntegrationService,
)

import dotenv

from py_core.system.model import UserLocale

import sys
import dashscope
from dashscope.audio.tts_v2 import (
    SpeechSynthesizer,
    ResultCallback,
    SpeechSynthesizerObjectPool,
)

from functools import cached_property
from os import path
from time import perf_counter
import pendulum
from pydantic import BaseModel
import hashlib
from diskcache import Cache
from asyncio import to_thread
from nanoid import generate

from py_core.config import AACessTalkConfig


def init_api_key():
    """初始化 API Key"""
    # 新加坡和北京地域的API Key不同。获取API Key：https://www.alibabacloud.com/help/zh/model-studio/get-api-key
    # 若没有配置环境变量，请用百炼API Key将下行替换为：dashscope.api_key = "sk-xxx"
    dotenv.load_dotenv()
    dashscope.api_key = os.environ.get("DASHSCOPE_API_KEY", "YOUR_API_KEY")
    if dashscope.api_key == "YOUR_API_KEY":
        print(
            "[Warning] Using placeholder API key, set DASHSCOPE_API_KEY environment variable."
        )


class VoiceSynthesizerCallback(ResultCallback):
    def __init__(self, file_path: str, task_id: str, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.file_path = file_path
        self.file = None
        self.task_id = task_id
        self.loop = loop
        self.done_event = asyncio.Event()

    def on_open(self):
        self.file = open(self.file_path, "wb")
        print(
            f"[task_{self.task_id}] Voice synthesis started, saving to {self.file_path}"
        )

    def on_data(self, data: bytes) -> None:
        # print(f"[task_{self.task_id}] Received {len(data)} bytes of audio data")
        if self.file:
            self.file.write(data)

    def on_complete(self):
        print(f"[task_{self.task_id}] Voice synthesis completed successfully.")
        if self.file:
            self.file.close()
        self.loop.call_soon_threadsafe(self.done_event.set)

    def on_error(self, message: str):
        print(f"[task_{self.task_id}] Voice synthesis failed: {message}")
        if self.file:
            self.file.close()
        self.loop.call_soon_threadsafe(self.done_event.set)


class CacheKeyParams(BaseModel):
    text: str
    service: str = "dashscope"
    user_locale: UserLocale
    voice: str
    model: str

    @cached_property
    def cache_key(self) -> str:
        params_string = self.model_dump_json()
        return hashlib.md5(params_string.encode()).hexdigest()


class YueParams(CacheKeyParams):
    model: str = "cosyvoice-v3-flash"
    voice: str = "longanyue_v3"


class ZhParams(CacheKeyParams):
    model: str = "cosyvoice-v3-flash"
    voice: str = "longanhuan"


class KoParams(CacheKeyParams):
    model: str = "cosyvoice-v2"
    voice: str = "loongjihun_v2"


class DashscopeCosyVoice(IntegrationService):
    USE_CONNECTION_POOL = True
    _connectionPool = None

    def __init__(self):
        super().__init__()
        init_api_key()
        if self.USE_CONNECTION_POOL and DashscopeCosyVoice._connectionPool is None:
            print("creating connection pool")
            start_time = time() * 1000
            DashscopeCosyVoice._connectionPool = SpeechSynthesizerObjectPool(max_size=3)
            end_time = time() * 1000
            print("connection pool created, cost: {} ms".format(end_time - start_time))
            atexit.register(DashscopeCosyVoice._shutdown_pool)

            # Handle signals for graceful shutdown in CLI/Terminal
            if sys.platform != "win32":
                for sig in (signal.SIGINT, signal.SIGTERM):
                    signal.signal(sig, lambda s, f: DashscopeCosyVoice._shutdown_pool())
            else:
                # On Windows, signal handling is limited, but we can try SIGINT
                signal.signal(
                    signal.SIGINT, lambda s, f: DashscopeCosyVoice._shutdown_pool()
                )

    def __del__(self):
        self._shutdown_pool()

    @classmethod
    def _shutdown_pool(cls):
        if cls._connectionPool is not None:
            print("Shutting down Dashscope connection pool...")
            try:
                cls._connectionPool.shutdown()
            except Exception as e:
                print(f"Error during pool shutdown: {e}")
            finally:
                cls._connectionPool = None

            # If we are in a signal handler or atexit, we might want to force exit
            # if it's still hanging, but let's try this first.

    @classmethod
    def provider_name(cls) -> str:
        return "Dashscope CosyVoice"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, str]
    ) -> bool:
        return True

    async def create_voice(self, text: str, user_locale: UserLocale) -> str:
        cache_params = None
        if (
            user_locale == UserLocale.SimplifiedChinese
            or user_locale == UserLocale.English
        ):
            cache_params = ZhParams(text=text, user_locale=user_locale)
        elif user_locale == UserLocale.TraditionalChinese:
            cache_params = YueParams(text=text, user_locale=user_locale)
        elif user_locale == UserLocale.Korean:
            cache_params = KoParams(text=text, user_locale=user_locale)
        else:
            raise Exception(f"Unsupported locale for Dashscope Voice: {user_locale}")

        cache = Cache(AACessTalkConfig.voiceover_cache_dir_path)

        def get_from_cache():
            if cache_params.cache_key in cache:
                file_path = cache[cache_params.cache_key]
                if path.exists(file_path):
                    return file_path
                else:
                    cache.delete(cache_params.cache_key)
                    print(
                        "Cached file does not exist. Invalidate cache and regenerate the audio..."
                    )
            return None

        cached_file = await to_thread(get_from_cache)
        if cached_file:
            print(f'Use cached voiceover file for "{text}"...')
            return cached_file

        timestamp = pendulum.now().format("YYYY-MM-DD-HH-mm-ss", locale="en")
        file_path = path.join(
            AACessTalkConfig.voiceover_cache_dir_path,
            f"voiceover_{timestamp}_{generate(size=8)}.mp3",
        )

        loop = asyncio.get_running_loop()
        synthesizer_callback = VoiceSynthesizerCallback(
            file_path=file_path, task_id=f"{timestamp}:{text[:8]}", loop=loop
        )

        if self.USE_CONNECTION_POOL and DashscopeCosyVoice._connectionPool is not None:
            speech_synthesizer = DashscopeCosyVoice._connectionPool.borrow_synthesizer(
                model=cache_params.model,
                voice=cache_params.voice,
                seed=12382,
                callback=synthesizer_callback,
            )
        else:
            speech_synthesizer = SpeechSynthesizer(
                model=cache_params.model,
                voice=cache_params.voice,
                seed=12382,
                callback=synthesizer_callback,
            )

        t_s = perf_counter()

        try:
            await to_thread(speech_synthesizer.call, text)
            await asyncio.wait_for(synthesizer_callback.done_event.wait(), timeout=60)
        except Exception as e:
            print(
                f"[task_{synthesizer_callback.task_id}] speech synthesis task failed, {e}"
            )
            speech_synthesizer.close()
            return ""

        print(
            "[task_{}] Synthesized text: {}".format(synthesizer_callback.task_id, text)
        )
        print(
            "[task_{}][Metric] requestId: {}, first package delay ms: {}".format(
                synthesizer_callback.task_id,
                speech_synthesizer.get_last_request_id(),
                speech_synthesizer.get_first_package_delay(),
            )
        )
        if self.USE_CONNECTION_POOL and DashscopeCosyVoice._connectionPool is not None:
            DashscopeCosyVoice._connectionPool.return_synthesizer(speech_synthesizer)
        else:
            speech_synthesizer.close()

        t_end = perf_counter()

        print(f"Dashscope Voice generation took {t_end - t_s} sec.")
        await to_thread(cache.set, cache_params.cache_key, file_path)
        return file_path


class DashscopeQwenTTS(IntegrationService):
    def __init__(self):
        super().__init__()
        init_api_key()

    @classmethod
    def provider_name(cls) -> str:
        return "Dashscope QwenTTS"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, str]
    ) -> bool:
        return True

    async def create_voice(self, text: str, user_locale: UserLocale) -> str:
        if user_locale == UserLocale.TraditionalChinese:
            voice = "Kiki"
        else:
            voice = "Cherry"

        cache_params = CacheKeyParams(
            text=text,
            user_locale=user_locale,
            service="dashscope_qwen_tts",
            model="qwen3-tts-flash",
            voice=voice,
        )

        cache = Cache(AACessTalkConfig.voiceover_cache_dir_path)

        def get_from_cache():
            if cache_params.cache_key in cache:
                file_path = cache[cache_params.cache_key]
                if path.exists(file_path):
                    return file_path
                else:
                    cache.delete(cache_params.cache_key)
                    print(
                        "Cached file does not exist. Invalidate cache and regenerate the audio..."
                    )
            return None

        cached_file = await to_thread(get_from_cache)
        if cached_file:
            print(f'Use cached voiceover file for "{text}"...')
            return cached_file

        t_s = perf_counter()
        dashscope.base_http_api_url = "https://dashscope.aliyuncs.com/api/v1"
        response = await to_thread(
            dashscope.MultiModalConversation.call,
            model="qwen3-tts-flash",
            api_key=str(dashscope.api_key),
            text=text,
            voice=voice,
            language_type="Auto",  # 建议与文本语种一致，以获得正确的发音和自然的语调。
            stream=False,
        )

        # • 200：请求成功，正常返回结果
        # • 400：客户端请求参数错误
        # • 401：未授权访问
        # • 404：资源未找到
        # • 500：服务器内部错误。
        if isinstance(response, MultiModalConversationResponse):
            if response["status_code"] != 200:
                print(
                    f"Dashscope QWEN Voice synthesis failed with status code {response['status_code']}: {response['message']}"
                )
                return ""
            audio_content = response["output"]["audio"]
            if not isinstance(audio_content, Audio):
                print("No audio content received from Dashscope QWEN TTS.")
                return ""

            audio_file_url = audio_content["url"]

            # Download the audio data
            async with httpx.AsyncClient() as client:
                resp = await client.get(audio_file_url)
                audio_data = resp.content

            timestamp = pendulum.now().format("YYYY-MM-DD-HH-mm-ss", locale="en")
            file_path = path.join(
                AACessTalkConfig.voiceover_cache_dir_path,
                f"voiceover_{timestamp}_{generate(size=8)}.mp3",
            )
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(audio_data)
        else:
            print("Unexpected response type from Dashscope QWEN TTS.")
            print(type(response))
            return ""

        t_end = perf_counter()

        print(f"Dashscope QWEN Voice generation took {t_end - t_s} sec.")

        await to_thread(cache.set, cache_params.cache_key, file_path)
        return file_path

class DashscopeQwenSpeechRecognizer(SpeechRecognizerBase, IntegrationService):
    def __init__(self):
        super().__init__()
        init_api_key()

    @classmethod
    def provider_name(cls) -> str:
        return "Dashscope Qwen Speech Recognizer"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, str]
    ) -> bool:
        return True

    async def recognize_speech(
        self,
        file_path: str,
        file,
        content_type: str = "",
        locale: UserLocale = UserLocale.SimplifiedChinese,
        child_name: str = "",
        hotwords: list[str] = [],
    ) -> str:
        class MyCallback(OmniRealtimeCallback):
            """实时识别回调处理"""
            def __init__(self, conversation, done_event: asyncio.Event):
                self.conversation = conversation
                self.done_event = done_event
                self.final_text: str | None = None
                self.loop = asyncio.get_event_loop()
                self.handlers = {
                    'session.created': self._handle_session_created,
                    'conversation.item.input_audio_transcription.completed': self._handle_final_text,
                    'conversation.item.input_audio_transcription.text': self._handle_stash_text,
                    'input_audio_buffer.speech_started': lambda r: print('======Speech Start======'),
                    'input_audio_buffer.speech_stopped': lambda r: print('======Speech Stop======')
                }

            def on_open(self):
                print('Connection opened')

            def on_close(self, close_status_code, close_msg):
                print(f"Connection closed, code: {close_status_code}, msg: {close_msg}")

            def on_event(self, message):
                try:
                    handler = self.handlers.get(message["type"])
                    if handler:
                        handler(message)
                except Exception as e:
                    print(f'[Error] {e}')

            def _handle_session_created(self, response):
                print(f"Start session: {response['session']['id']}")

            def _handle_final_text(self, response):
                # store final transcript and notify waiting coroutine
                self.final_text = response.get('transcript', '')
                print(f"Final recognized text: {self.final_text}")
                # If callback runs in another thread, ensure event is set on the loop thread-safely
                try:
                    self.loop.call_soon_threadsafe(self.done_event.set)
                except Exception:
                    # fallback if loop is closed/not available
                    self.done_event.set()

            def _handle_stash_text(self, response):
                print(f"Got stash result: {response.get('stash')}")

        async def read_audio_chunks(file_path, chunk_size=3200):
            """按块读取音频文件"""
            async with aiofiles.open(file_path, 'rb') as f:
                if content_type == 'audio/wav':
                    # 跳过WAV文件头44字节
                    await f.seek(44)
                while chunk := await f.read(chunk_size):
                    yield chunk
        async def send_audio(conversation, file_path, delay=0.1):
            """发送音频数据"""
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Audio file {file_path} does not exist.")

            async for chunk in read_audio_chunks(file_path):
                audio_b64 = base64.b64encode(chunk).decode('ascii')
                conversation.append_audio(audio_b64)
                await asyncio.sleep(delay)

            # enable_turn_detection为False时，应将下行代码注释取消
            # conversation.commit()
            # print("Audio commit sent.")


        async def send_silence_data(conversation, cycles=30, bytes_per_cycle=1024):
            # 创建1024字节的静音数据（全零）
            silence_data = bytes(bytes_per_cycle)

            for i in range(cycles):
                # 将字节数据编码为base64
                audio_b64 = base64.b64encode(silence_data).decode('ascii')
                # 发送静音数据
                conversation.append_audio(audio_b64)
                await asyncio.sleep(0.01)  # 10毫秒延迟
            # print(f"已发送 {cycles} 次静音数据，每次 {bytes_per_cycle} 字节")

        audio_file_path = file_path
        if pathlib.Path(file_path).suffix == ".wav":
            # set content type for wav file
            content_type = "audio/wav"

        done_event = asyncio.Event()
        conversation = OmniRealtimeConversation(
            model="qwen3-asr-flash-realtime",
            # 以下为北京地域url，若使用新加坡地域的模型，需将url替换为：wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime
            url="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            callback=MyCallback(
                conversation=None, done_event=done_event
            ),  # 暂时传None，稍后注入
        )

        # 注入自身到回调
        if not isinstance(conversation.callback, MyCallback):
            raise Exception("Should never happen: Callback type mismatch.")

        conversation.callback.conversation = conversation

        conversation.connect()

        transcription_params = TranscriptionParams(
            # language="zh",
            sample_rate=8000,
            input_audio_format="pcm",
            # 输入音频的语料，用于辅助识别
            corpus_text=str(hotwords + [child_name]),
        )

        conversation.update_session(
            output_modalities=[MultiModality.TEXT],
            enable_input_audio_transcription=True,
            transcription_params=transcription_params,
        )

        try:
            # ensure we await sending audio and silence
            await send_audio(conversation, audio_file_path)
            await send_silence_data(conversation)
        except Exception as e:
            print(f"Error occurred: {e}")

        # wait for final transcript (timeout as needed)
        final_text = ""
        try:
            await asyncio.wait_for(done_event.wait(), timeout=10.0)
            final_text = conversation.callback.final_text or ""
        except asyncio.TimeoutError:
            print(
                "Timed out waiting for final transcript. Returning partial result if available."
            )
            final_text = conversation.callback.final_text or ""
        finally:
            conversation.close()
            print("Audio processing completed.")

        return final_text

class DashscopeFunAsrFileRecognizer(SpeechRecognizerBase, IntegrationService):
    def __init__(self):
        super().__init__()
        init_api_key()

    @classmethod
    def provider_name(cls) -> str:
        return "Dashscope Fun-ASR File Recognizer"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, str]
    ) -> bool:
        return True

    async def recognize_speech(
        self,
        file_url,
        file,
        content_type: str = "",
        locale: UserLocale = UserLocale.SimplifiedChinese,
        child_name: str = "",
        hotwords: list[str] = [],
    ) -> str:
        raise DeprecationWarning("Dashscope Fun-ASR File Recognizer is deprecated for not fast enough. Use DashscopeQwenSpeechRecognizer instead.")
        return await DashscopeQwenSpeechRecognizer.recognize_speech(
            file_url,
            file,
            content_type,
            locale,
            child_name,
            hotwords,
        )

        dashscope.base_http_api_url = "https://dashscope.aliyuncs.com/api/v1"

        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[file_url]
        )

        transcribe_response = Transcription.wait(task=task_response.output.task_id)
        if transcribe_response.status_code == HTTPStatus.OK:
            print('transcription done!')
            return transcribe_response.output.transcripts.text
        else:
            print(f"Transcription failed with status code {transcribe_response.status_code}: {transcribe_response.message}")
            return ""
