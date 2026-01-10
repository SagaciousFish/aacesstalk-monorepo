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


@pytest.mark.anyio
async def test_refresh_avoids_repeating(monkeypatch):
    # Ensure that when the mapper repeatedly returns the same recommendation as
    # the previous one, generate() will avoid returning identical consecutive
    # recommendations (by retrying and ultimately falling back to a shifted
    # deterministic set).
    gen = ChildCardRecommendationGenerator(vector_db=None)

    async def constant_run(*args, **kwargs):
        return ChildCardRecommendationAPIResult(
            topics=set(["Pleasant Goat", "Wolf", "Adventure", "Friends"]),
            actions=set(["Play", "Run", "Help", "Laugh"]),
            emotions=set(["Happy", "Glad", "Surprised", "Delighted"]),
        )

    # Patch the mapper to always return the same recommendation (simulate repeated identical LLM output)
    gen._ChildCardRecommendationGenerator__mapper.run = constant_run

    # Build a previous recommendation that matches the constant mapper output
    from py_core.system.model import CardInfo, CardCategory, ChildCardRecommendationResult

    rec_id = "prev1"
    prev_cards = []
    for t in ["Pleasant Goat", "Wolf", "Adventure", "Friends"]:
        prev_cards.append(
            CardInfo(
                label=t,
                label_localized=t,
                category=CardCategory.Topic,
                recommendation_id=rec_id,
            )
        )
    for a in ["Play", "Run", "Help", "Laugh"]:
        prev_cards.append(
            CardInfo(
                label=a,
                label_localized=a,
                category=CardCategory.Action,
                recommendation_id=rec_id,
            )
        )

    prev = ChildCardRecommendationResult(id=rec_id, turn_id="turn", cards=prev_cards)

    # Force a non-zero shift by monkeypatching time.time
    import py_core.system.task.card_recommendation.generator as genmod

    monkeypatch.setattr(genmod.time, "time", lambda: 1)

    topic_info = SessionTopicInfo(category=SessionTopicCategory.Free, subtopic="x")
    dialogue = [DialogueMessage.example_parent_message("No translated text found")]

    res = await gen.generate(
        "turn1",
        UserLocale.English,
        ParentType.Father,
        topic_info,
        dialogue,
        previous_recommendation=prev,
    )

    labels = {c.label for c in res.cards if c.category == CardCategory.Topic}
    assert labels != {"Pleasant Goat", "Wolf", "Adventure", "Friends"}


@pytest.mark.anyio
async def test_duplicate_words_across_categories_collapse(monkeypatch):
    # If the same English word appears in topics and actions, the generator
    # should emit a single card for that word rather than duplicated cards.
    gen = ChildCardRecommendationGenerator(vector_db=None)

    async def overlapping_run(*args, **kwargs):
        return ChildCardRecommendationAPIResult(
            topics=set(["Play", "Run", "Help", "Laugh"]),
            actions=set(["Play", "Jump", "Sing", "Dance"]),
            emotions=set(["Happy", "Glad", "Surprised", "Delighted"]),
        )

    gen._ChildCardRecommendationGenerator__mapper.run = overlapping_run

    topic_info = SessionTopicInfo(category=SessionTopicCategory.Free, subtopic="x")
    dialogue = [DialogueMessage.example_parent_message("No translated text found")]

    res = await gen.generate(
        "turn1",
        UserLocale.English,
        ParentType.Father,
        topic_info,
        dialogue,
    )

    # Count topic/action cards
    ta_cards = [c for c in res.cards if c.category in (CardCategory.Topic, CardCategory.Action)]
    labels = [c.label for c in ta_cards]

    # 'Play' should appear exactly once
    assert labels.count("Play") == 1

    # Total unique labels should equal length of ta_cards (no accidental merging of different words)
    assert len(set(labels)) == len(labels)
