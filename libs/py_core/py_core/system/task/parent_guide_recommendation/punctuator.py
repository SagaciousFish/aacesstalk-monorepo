from chatlib.llm.integration import GPTChatCompletionAPI
from chatlib.tool.versatile_mapper import ChatCompletionFewShotMapper, ChatCompletionFewShotMapperParams

class Punctuator:
    def __init__(self) -> None:
        self.__mapper = ChatCompletionFewShotMapper.make_str_mapper(
            GPTChatCompletionAPI(),
            """
The user will give you a utterance recorded and dictated by ASR.
Put or modify punctuations to the sentence. It is important to put a question mark to sentences that are suspicious to be a question.""",
        )

    async def punctuate(self, original: str)-> str:
        return await self.__mapper.run(
            None,
            original,
            ChatCompletionFewShotMapperParams(
                model="qwen3-max", api_params={"max_tokens": 512}
            ),
        )