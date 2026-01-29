import asyncio

from py_core.utils.speech.clova_voice import ClovaVoice, ClovaVoiceParams
from chatlib.global_config import GlobalConfig

from py_core.system.model import UserLocale
from py_core.utils.speech.dashscope_audio import DashscopeCosyVoice, DashscopeQwenTTS

GlobalConfig.is_cli_mode = True


def test_clova_voice_authorization_and_creation():
    ClovaVoice.assert_authorize()

    cv = ClovaVoice()

    file_path = asyncio.run(
        cv.create_voice(
            "액세스톡은 자폐 스펙트럼 장애를 가진 아동과 부모 간의 의사소통을 돕는 AI기반 맥락형 기술입니다.",
            ClovaVoiceParams(pitch=3),
        )
    )

    print(file_path)


def test_dashscope_voice_authorization_and_creation():
    cv = DashscopeCosyVoice()

    file_path = asyncio.run(
        cv.create_voice(
            "听话啦，别闹脾气啦！我们去吃冰淇淋，好不好？",
            UserLocale.TraditionalChinese,
        )
    )

    print(file_path)


def test_dashscope_qwentts_voice_authorization_and_creation():
    cv = DashscopeQwenTTS()

    file_path = asyncio.run(
        cv.create_voice(
            # "Hello! This is a test of the QWEN TTS voice synthesis capabilities.",
            # UserLocale.English,
            "听话啦，别闹脾气啦！我砥去吃雪糕，好不好？",
            UserLocale.TraditionalChinese,
        )
    )

    print(file_path)


test_dashscope_qwentts_voice_authorization_and_creation()
