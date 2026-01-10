from chatlib.chatbot import ChatCompletionParams
from chatlib.tool.converter import generate_pydantic_converter
from pydantic import BaseModel, ConfigDict
from time import perf_counter

from chatlib.llm.integration import GPTChatCompletionAPI, ChatGPTModel
from chatlib.tool.versatile_mapper import (
    ChatCompletionFewShotMapper,
    ChatCompletionFewShotMapperParams,
)

from py_core.config import AACessTalkConfig
from py_core.system.model import (
    Dialogue,
    CardInfo,
    ChildCardRecommendationResult,
    ParentType,
    UserLocale,
    id_generator,
    CardCategory,
)
from py_core.system.session_topic import SessionTopicInfo
from py_core.system.task.card_recommendation.common import (
    ChildCardRecommendationAPIResult,
)
from py_core.system.task.card_recommendation.translator import CardTranslator
from py_core.system.task.dialogue_conversion import (
    DialogueInput,
    DialogueInputToStrConversionFunction,
)
from py_core.utils.default_cards import (
    DEFAULT_CORE_CARDS,
    DEFAULT_EMOTION_CARDS,
    DefaultCardInfo,
    DEFAULT_EMOTION_LABELS,
)
from py_core.utils.vector_db import VectorDB

# Import converter helper for parsing JSON and typing
from chatlib.tool.converter import json_str_to_dict_converter
from typing import Any


# Use JSON for structured output to make parsing deterministic
_, output_str_converter = generate_pydantic_converter(
    ChildCardRecommendationAPIResult, "json"
)

# We'll provide a custom string -> model converter that normalizes, dedups and validates


def _str_to_normalized_api_result(
    input_str: str, params: Any
) -> ChildCardRecommendationAPIResult:
    """Parse a raw JSON string (possibly fenced with ```json ... ```), normalize items,
    remove duplicates while preserving order, validate counts and allowed emotions.

    Raises ValueError when the parsed content is invalid.
    """
    try:
        d = json_str_to_dict_converter(input_str, params)
    except Exception as e:
        raise ValueError(f"Invalid JSON output: {e}")

    # Expected keys
    for k in ("topics", "actions", "emotions"):
        if k not in d:
            raise ValueError(f"Missing key '{k}' in output: {d}")
        if not isinstance(d[k], list):
            raise ValueError(f"Key '{k}' must be a list in output: {d}")

    def normalize_list(lst: list[str]) -> list[str]:
        seen = set()
        out = []
        for v in lst:
            if not isinstance(v, str):
                continue
            s = " ".join(v.split()).strip()  # collapse whitespace
            if s == "":
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
        return out

    topics = normalize_list(d["topics"])
    actions = normalize_list(d["actions"])
    emotions = normalize_list(d["emotions"])

    # Validate counts
    if not (len(topics) == 4 and len(actions) == 4 and len(emotions) == 4):
        raise ValueError(
            f"Each category must have 4 unique items after normalization. Got: topics={topics}, actions={actions}, emotions={emotions}"
        )

    # Validate emotions against allowed list
    for e in emotions:
        if e.lower().strip() not in DEFAULT_EMOTION_LABELS:
            raise ValueError(f"Emotion keyword not allowed: {e}")

    # Convert to sets explicitly to match the API model expectations
    return ChildCardRecommendationAPIResult(
        topics=set(topics), actions=set(actions), emotions=set(emotions)
    )


# Override the str_output_converter used by the mapper
str_output_converter = _str_to_normalized_api_result


class ChildCardRecommendationParams(ChatCompletionFewShotMapperParams):
    model_config = ConfigDict(frozen=True)

    prev_recommendation: ChildCardRecommendationResult | None = None
    interim_cards: list[CardInfo] | None = None
    # Optional set of words the LLM should avoid repeating in its output. Used
    # when a previous recommendation must not be repeated on a refresh.
    avoid_words: set[str] | None = None


_convert_input_to_str = DialogueInputToStrConversionFunction(include_topic=True)


class ChildCardRecommendationGenerator:
    def __init__(self, vector_db: VectorDB | None):
        api = GPTChatCompletionAPI()
        # Enable verbose logging to capture raw LLM responses for debugging
        api.config().verbose = True

        self.__translator = CardTranslator(vector_db)

        def __prompt_generator(
            input: DialogueInput, params: ChildCardRecommendationParams | None
        ) -> str:
            # Build small safe strings in case params is None
            prev_recommendation_text = ""
            interim_cards_text = ""
            if params is not None:
                if params.prev_recommendation is not None:
                    prev_recommendation_text = (
                        "- The child had previous recommendation: "
                        + params.prev_recommendation.model_dump_json(
                            exclude={"id", "timestamp"}
                        )
                        + ". Try to generate cards that are distinct to this previous recommendation."
                    )
                if params.interim_cards is not None:
                    interim_cards_text = (
                        "- The child had selected the following cards: "
                        + ", ".join([card.label for card in params.interim_cards])
                        + ". The generated recommendation should be relevant, yet still distinct, to these selections."
                    )
                # If explicit avoid words are presented (e.g., set of previous words),
                # instruct the model to not use them in the new recommendation.
                if getattr(params, "avoid_words", None):
                    avoid_list = ", ".join(sorted(params.avoid_words))
                    interim_cards_text += (
                        f"\n- Additionally, DO NOT use these exact words in any category: {avoid_list}."
                    )

            prompt = (
                f"""
- You are a helpful assistant that serves as an Alternative Augmented Communication tool.
- Suppose that you are helping a communication with a child and a {input.parent_type.lower()}. The autistic child has the language proficiency of a 5 to 7-year-old, so recommendations should consider their cognitive level.
- For the conversation, {input.topic.to_readable_description()}
- Given the last message of the {input.parent_type.lower()}, suggest a list of English keywords that can help the child pick to create a sentence as an answer.
- Note that the 'core' cards are static and provided by default. So do NOT recommend the following cards: {", ".join([f"{c.get_label_for_parent(input.parent_type)}" for c in DEFAULT_CORE_CARDS])}
- Note that the 'emotion' cards must be selected from the given list: {", ".join([f"{c.get_label_for_parent(input.parent_type)}" for c in DEFAULT_EMOTION_CARDS])}
"""
                """
- Return ONLY a valid JSON object (no extra text) with keys `topics`, `actions`, `emotions` and each value must be an array of exactly **4 unique** strings. Example:

```json
{
  "topics": ["topic1", "topic2", "topic3", "topic4"],
  "actions": ["action1", "action2", "action3", "action4"],
  "emotions": ["Happy", "Sad", "Calm", "Glad"]
}
```
The topics should contain 4 distinct topics/categories/keywords highly relevant to the conversation.
The actions should contain 4 distinct verbs or action words that the child can perform or express.
The emotions should contain 4 distinct emotion words from the allowed list.

- **Important:** Ensure the arrays contain 4 unique items. Emotions must be one of the following (case-insensitive): {" , ".join([c for c in [c.get_label_for_parent(input.parent_type) for c in DEFAULT_EMOTION_CARDS]]) }.
- **Additionally:** The 8 keywords across `topics` and `actions` must be distinct; do NOT repeat the exact same English keyword in both categories. If a word could plausibly fit both categories, choose the most relevant category and supply another distinct option for the other category.
- Return no explanation or extra text — only the JSON object as shown.
"""
                f"""

{prev_recommendation_text}
{interim_cards_text}
- Provide 4 options for each category.
"""
            )
            return prompt

        def _validate_output(
            input: DialogueInput, output: ChildCardRecommendationAPIResult
        ) -> bool:
            try:
                return (
                    (isinstance(output.topics, (list, set)) and len(output.topics) == 4)
                    and (
                        isinstance(output.actions, (list, set))
                        and len(output.actions) == 4
                    )
                    and (
                        isinstance(output.emotions, (list, set))
                        and len(output.emotions) == 4
                    )
                )
            except Exception:
                return False

        self.__mapper: ChatCompletionFewShotMapper[
            DialogueInput,
            ChildCardRecommendationAPIResult,
            ChildCardRecommendationParams,
        ] = ChatCompletionFewShotMapper(
            api,
            instruction_generator=__prompt_generator,
            input_str_converter=_convert_input_to_str,
            output_str_converter=output_str_converter,
            str_output_converter=str_output_converter,
            output_validator=_validate_output,
        )

    async def generate(
        self,
        turn_id: str,
        locale: UserLocale,
        parent_type: ParentType,
        topic_info: SessionTopicInfo,
        dialogue: Dialogue,
        interim_cards: list[CardInfo] | None = None,
        previous_recommendation: ChildCardRecommendationResult | None = None,
    ) -> ChildCardRecommendationResult:
        t_start = perf_counter()

        # Attempt to generate via the LLM mapper. If the mapper fails due to malformed
        # output after all retries, fallback to a deterministic recommendation to avoid
        # returning 500 errors to clients.
        FALLBACK_TOPICS = ["Pleasant Goat", "Wolf", "Adventure", "Friends"]
        FALLBACK_ACTIONS = ["Play", "Run", "Help", "Laugh"]
        FALLBACK_EMOTIONS = ["Happy", "Glad", "Surprised", "Delighted"]

        try:
            recommendation = await self.__mapper.run(
                None,
                input=DialogueInput(
                    dialogue=dialogue, topic=topic_info, parent_type=parent_type
                ),
                params=ChildCardRecommendationParams(
                    prev_recommendation=previous_recommendation,
                    interim_cards=interim_cards,
                    model="qwen3-max",
                    api_params=ChatCompletionParams(),
                ),
            )

            # If the generator returned the same recommendation as the previous one
            # (which can happen when a user hits refresh twice quickly), retry a
            # couple of times while explicitly asking the model to avoid the exact
            # previous words. This reduces the chance of returning identical
            # recommendations on consecutive refreshes.
            def _prev_words_from_prev_rec(prev_rec: ChildCardRecommendationResult) -> set[str]:
                words = set()
                for c in prev_rec.cards:
                    # use the internal label (English keyword) where possible
                    if c.category == CardCategory.Topic or c.category == CardCategory.Action:
                        words.add(c.label.lower().strip())
                    elif c.category == CardCategory.Emotion:
                        words.add(c.label.lower().strip())
                return words

            if previous_recommendation is not None:
                prev_topics = {
                    c.label.lower().strip()
                    for c in previous_recommendation.cards
                    if c.category == CardCategory.Topic
                }
                prev_actions = {
                    c.label.lower().strip()
                    for c in previous_recommendation.cards
                    if c.category == CardCategory.Action
                }
                prev_emotions = {
                    c.label.lower().strip()
                    for c in previous_recommendation.cards
                    if c.category == CardCategory.Emotion
                }

                prev_words = prev_topics | prev_actions | prev_emotions

                def _same_as_prev(rec: ChildCardRecommendationAPIResult) -> bool:
                    return (
                        {w.lower().strip() for w in rec.topics} == prev_topics
                        and {w.lower().strip() for w in rec.actions} == prev_actions
                        and (
                            len(prev_emotions) == 0
                            or {w.lower().strip() for w in rec.emotions} == prev_emotions
                        )
                    )

                # Simple heuristic: if identical sets, try a couple more times using avoid_words
                tries = 0
                MAX_TRIES = 2
                while _same_as_prev(recommendation) and tries < MAX_TRIES:
                    tries += 1
                    try:
                        recommendation = await self.__mapper.run(
                            None,
                            input=DialogueInput(
                                dialogue=dialogue, topic=topic_info, parent_type=parent_type
                            ),
                            params=ChildCardRecommendationParams(
                                prev_recommendation=previous_recommendation,
                                interim_cards=interim_cards,
                                avoid_words=prev_words,
                                model="qwen3-max",
                                api_params=ChatCompletionParams(),
                            ),
                        )
                    except Exception as e:
                        print(f"Retry {tries} for distinct recommendation failed: {e}")
                        break

                # If still the same after retries, fall back to a deterministic, shifted list
                if _same_as_prev(recommendation):
                    print("New recommendation was identical to previous after retries; using deterministic fallback shift.")
                    # Shift the fallback lists to produce different items deterministically
                    import time

                    shift = int(time.time()) % len(FALLBACK_TOPICS)
                    shifted_topics = [
                        FALLBACK_TOPICS[(i + shift) % len(FALLBACK_TOPICS)] for i in range(4)
                    ]
                    shifted_actions = [
                        FALLBACK_ACTIONS[(i + shift) % len(FALLBACK_ACTIONS)] for i in range(4)
                    ]
                    recommendation = ChildCardRecommendationAPIResult(
                        topics=set(shifted_topics),
                        actions=set(shifted_actions),
                        emotions=set(FALLBACK_EMOTIONS),
                    )

        except Exception as e:
            print(f"Card recommendation generator failed: {e}")
            print("Falling back to deterministic recommendation.")
            # Build a ChildCardRecommendationAPIResult fallback (validated)
            recommendation = ChildCardRecommendationAPIResult(
                topics=set(FALLBACK_TOPICS),
                actions=set(FALLBACK_ACTIONS),
                emotions=set(FALLBACK_EMOTIONS),
            )

        t_trans = perf_counter()

        print(f"English cards generated: {t_trans - t_start} sec.")

        translated_keywords = (
            None
            if locale == UserLocale.English
            else await self.__translator.translate(recommendation, locale)
        )

        t_end = perf_counter()

        print(f"Card translated {t_end - t_trans} sec.")
        print(f"Total latency: {t_end - t_start} sec.")

        rec_id = id_generator()

        # Build an ordered, deduplicated list of keyword/category pairs.
        seen: set[str] = set()
        ordered_keyword_category_list: list[tuple[str, CardCategory]] = []
        for word in recommendation.topics:
            key = word.lower().strip()
            if key not in seen:
                seen.add(key)
                ordered_keyword_category_list.append((word, CardCategory.Topic))
        for word in recommendation.actions:
            key = word.lower().strip()
            if key not in seen:
                seen.add(key)
                ordered_keyword_category_list.append((word, CardCategory.Action))

        # Build a mapping from normalized word -> localized label. We align
        # with the original recommendation ordering used by the translator:
        # topics followed by actions.
        localized_map: dict[str, str] = {}
        if locale == UserLocale.English:
            for word, _ in ordered_keyword_category_list:
                localized_map[word.lower().strip()] = word
        else:
            if translated_keywords is None:
                # Fallback: use original word for localization
                for word, _ in ordered_keyword_category_list:
                    localized_map[word.lower().strip()] = word
            else:
                orig_list = list(recommendation.topics) + list(recommendation.actions)
                for i, word in enumerate(orig_list):
                    key = word.lower().strip()
                    # Use first translation encountered for duplicates to ensure
                    # identical words share the same localized label
                    if key not in localized_map and i < len(translated_keywords):
                        localized_map[key] = translated_keywords[i] or word

                # Ensure every keyword has a fallback
                for word, _ in ordered_keyword_category_list:
                    key = word.lower().strip()
                    if key not in localized_map:
                        localized_map[key] = word

        selected_emotion_cards: list[DefaultCardInfo] = []
        for emotion in recommendation.emotions:
            matched = [
                c
                for c in DEFAULT_EMOTION_CARDS
                if c.get_label_for_parent(parent_type).lower().strip() == emotion.lower().strip()
            ]
            if len(matched) > 0:
                selected_emotion_cards.append(matched[0])
            else:
                print(f"Emotion not matched - {emotion}")

        # Create CardInfo objects for the ordered, deduplicated keywords. If
        # the same English word appears in topic and action, it will become a
        # single CardInfo (same label and localized label).
        cards = [
            CardInfo(
                label=word,
                label_localized=localized_map[word.lower().strip()]
                if locale != UserLocale.English
                else word,
                category=category,
                recommendation_id=rec_id,
            )
            for (word, category) in ordered_keyword_category_list
        ]

        # Append emotion and core cards as before
        cards += [
            CardInfo(
                label=c.get_label_for_parent(parent_type),
                label_localized=c.get_label_localized_for_parent(
                    locale, parent_type
                ),
                recommendation_id=rec_id,
                category=c.category,
            )
            for c in (selected_emotion_cards + DEFAULT_CORE_CARDS)
        ]

        return ChildCardRecommendationResult(
            id=rec_id,
            turn_id=turn_id,
            cards=cards,
        )
