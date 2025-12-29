from time import perf_counter
import asyncio
import os
from typing import Any
from chatlib.utils.integration import (
    APIAuthorizationVariableSpec,
    IntegrationService,
)
from py_core.utils.speech.speech_recognizer_base import SpeechRecognizerBase
from torch.cuda import is_available as cuda_is_available
from py_core.system.model import UserLocale

from funasr import AutoModel


class FunASRNanoSpeechRecognizer(SpeechRecognizerBase, IntegrationService):
    _model: AutoModel | None = None
    _model_lock: asyncio.Lock | None = None
    _infer_lock: asyncio.Lock | None = None

    @classmethod
    async def initialize_service(cls) -> None:
        await cls._get_or_load_model()

    @classmethod
    def provider_name(cls) -> str:
        return "Fun-ASR"

    @classmethod
    def get_auth_variable_specs(cls) -> list[APIAuthorizationVariableSpec]:
        return []

    @classmethod
    def _authorize_impl(
        cls, variables: dict[APIAuthorizationVariableSpec, Any]
    ) -> bool:
        return True

    @classmethod
    async def _get_or_load_model(cls) -> AutoModel:
        # Fast-path if already loaded
        if cls._model is not None:
            return cls._model

        # Create the load lock on first use
        if cls._model_lock is None:
            cls._model_lock = asyncio.Lock()

        async with cls._model_lock:
            if cls._model is not None:
                return cls._model

            # Defer heavy/IO-bound model construction off the event loop
            def _load():
                import funasr.models.fun_asr_nano.model

                model_dir = "FunAudioLLM/Fun-ASR-MLT-Nano-2512"
                llm_conf_override = {
                    "init_param_path": "Qwen/Qwen3-0.6B",
                    "load_kwargs": {
                        "trust_remote_code": True,
                    },
                }
                device_name = "cuda:0" if cuda_is_available() else "cpu"
                # device_name = "cpu"  # Force CPU for now
                print(f"[FunASR-Nano] Loading model on device: {device_name}")

                m = AutoModel(
                    model=model_dir,
                    vad_model="fsmn-vad",
                    vad_kwargs={"max_single_segment_time": 60000},
                    device=device_name,
                    disable_update=True,
                    llm_conf=llm_conf_override,
                )
                return m

            cls._model = await asyncio.to_thread(_load)

            # Create an inference lock for safe shared usage (FunASR is not guaranteed thread-safe)
            if cls._infer_lock is None:
                cls._infer_lock = asyncio.Lock()

            return cls._model

    async def recognize_speech(
        self,
        file_path: str,
        file,
        content_type: str = "",
        locale: UserLocale = UserLocale.SimplifiedChinese,
        child_name: str = "",
        hotwords: list[str] = [],
    ) -> str:
        # Load (or reuse) the shared model instance
        model = await self._get_or_load_model()

        # Prefer a filesystem path for FunASR's loaders (it can accept file-like
        # objects, but some fallbacks expect strings).
        input_audio = file_path
        if hasattr(file, "name") and isinstance(getattr(file, "name"), str):
            if os.path.exists(file.name):
                input_audio = file.name
        elif isinstance(file_path, str) and os.path.exists(file_path):
            input_audio = file_path

        # Run inference off the event loop; guard with a lock for safety
        infer_lock = self.__class__._infer_lock
        if infer_lock is None:
            # Extremely unlikely if called before load completes, but ensure defined
            self.__class__._infer_lock = asyncio.Lock()
            infer_lock = self.__class__._infer_lock

        async with infer_lock:
            res = await asyncio.to_thread(
                model.generate,
                input=[input_audio],
                cache={},
                batch_size_s=0,
                hotwords=hotwords,
                itn=True,
            )

        text = res[0]["text"]
        return text
