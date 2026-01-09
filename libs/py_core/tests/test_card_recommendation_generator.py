import pytest
import json
from py_core.system.task.card_recommendation.generator import (
    _str_to_normalized_api_result,
    ChildCardRecommendationGenerator,
)
from py_core.system.task.card_recommendation.common import (
    ChildCardRecommendationAPIResult,
)
from py_core.system.model import UserLocale, ParentType, DialogueMessage
from py_core.system.session_topic import SessionTopicInfo, SessionTopicCategory


def fenced_json(obj: dict) -> str:
    return "```json\n" + json.dumps(obj, indent=2) + "\n```"


def test_str_to_normalized_api_result_valid():
    obj = {
        "topics": ["Pleasant Goat", "Wolf", "Adventure", "Friends"],
        "actions": ["Play", "Run", "Help", "Laugh"],
        "emotions": ["Happy", "Glad", "Surprised", "Delighted"],
    }
    s = fenced_json(obj)
    res = _str_to_normalized_api_result(s, None)
    assert isinstance(res, ChildCardRecommendationAPIResult)
    assert len(res.topics) == 4
    assert len(res.actions) == 4
    assert len(res.emotions) == 4


def test_str_to_normalized_api_result_duplicates_raise():
    obj = {
        # duplicates cause unique count < 4 after normalization
        "topics": ["A", "A", "B", "C"],
        "actions": ["a1", "a2", "a3", "a4"],
        "emotions": ["Happy", "Glad", "Surprised", "Delighted"],
    }
    s = fenced_json(obj)
    with pytest.raises(ValueError):
        _str_to_normalized_api_result(s, None)


def test_str_to_normalized_api_result_invalid_emotion_raise():
    obj = {
        "topics": ["T1", "T2", "T3", "T4"],
        "actions": ["a1", "a2", "a3", "a4"],
        "emotions": ["Happy", "NotAnEmotion", "Surprised", "Delighted"],
    }
    s = fenced_json(obj)
    with pytest.raises(ValueError):
        _str_to_normalized_api_result(s, None)


@pytest.mark.anyio
async def test_generate_fallback_on_exception(monkeypatch):
    gen = ChildCardRecommendationGenerator(vector_db=None)

    async def failing_run(*args, **kwargs):
        raise Exception("LLM failure")

    # Patch the mapper's run to always fail
    gen._ChildCardRecommendationGenerator__mapper.run = failing_run

    topic_info = SessionTopicInfo(category=SessionTopicCategory.Free, subtopic="喜羊羊")
    dialogue = [DialogueMessage.example_parent_message("No translated text found")]

    res = await gen.generate(
        "turn1", UserLocale.English, ParentType.Father, topic_info, dialogue
    )

    # Assert fallback topics/actions appear in returned cards
    labels = [c.label for c in res.cards]
    assert "Pleasant Goat" in labels
    assert "Play" in labels
    assert any(l in labels for l in ["Happy", "Glad", "Surprised", "Delighted"])
