import asyncio
import pathlib
from time import perf_counter

# import questionary
# from py_core.config import AACessTalkConfig
# from py_core.system.model import UserLocale
# from py_core.utils.speech import ClovaLongSpeech
from chatlib.global_config import GlobalConfig

# from py_core.utils.speech.whisper import WhisperSpeechRecognizer


GlobalConfig.is_cli_mode = True

ENGINE_TYPE_CLOVA_SPEECH = "Clova Speech"
ENGINE_TYPE_OPENAI_WHISPER = "OpenAI Whisper"
ENGINE_TYPE_LOCAL_FUNASR = "FunASR Nano-2512"
ENGINE_TYPE_ALIYUN_NLS = "Aliyun NLS"
ENGINE_TYPE_QWEN_ASR = "Qwen ASR"

engine = None
engine_type = ENGINE_TYPE_QWEN_ASR

# elif engine_type == ENGINE_TYPE_CLOVA_SPEECH:
#     ClovaLongSpeech.assert_authorize()
#     engine = ClovaLongSpeech()

# elif engine_type == ENGINE_TYPE_OPENAI_WHISPER:
#     WhisperSpeechRecognizer.assert_authorize()
#     engine = WhisperSpeechRecognizer()

if engine_type == ENGINE_TYPE_LOCAL_FUNASR:
    from py_core.utils.speech.funasr_nano import FunASRNanoSpeechRecognizer

    engine = FunASRNanoSpeechRecognizer()

elif engine_type == ENGINE_TYPE_ALIYUN_NLS:
    from py_core.utils.speech.aliyun_nls import AliyunSpeechRecognizer

    engine = AliyunSpeechRecognizer()
elif engine_type == ENGINE_TYPE_QWEN_ASR:
    from py_core.utils.speech.dashscope_audio import DashscopeQwenSpeechRecognizer

    engine = DashscopeQwenSpeechRecognizer()

if not engine:
    print("No engine selected.")
    exit(1)

print(f"Using engine: {engine_type}")


file_path = pathlib.Path("../../data/") / "samples/clova_sample_voice_2.m4a"
audio_dir = pathlib.Path(
    "F:\\dev\\aacesstalk-monorepo\\backend_data\\database\\user_data\\_fZ1sWnf6Wu9hmJOPQe8\\audio\\"
)
audio_dir = pathlib.Path("F:\\dev\\aacesstalk-monorepo\\data\\samples")
audio_dir = pathlib.Path(r"C:\Users\27475\Downloads\Voicemeeter")

for audio_file in audio_dir.iterdir():
    if audio_file.suffix not in [".wav", ".m4a", ".mp3", ".flac", ".ogg"]:
        continue

    t_s = perf_counter()
    file_path = audio_file
    file = open(file_path, "rb")

    # text = asyncio.run(engine.recognize_speech("clova_sample_voice.m4a", file, "audio/m4a"))

    resp = asyncio.run(engine.recognize_speech(str(file_path.absolute()), file))

    file.close()

    t_e = perf_counter()

    print(
        f"Conversion took {t_e - t_s} sec \nfor file: {file_path.name}  \nwith result: {resp}"
    )