from pydantic import BaseModel, ConfigDict, Field, field_validator
from py_core.utils.default_cards import DEFAULT_EMOTION_LABELS
from typing import Annotated, Set


class ChildCardRecommendationAPIResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    topics: Annotated[Set[str], Field(min_length=4, max_length=4)]
    actions: Annotated[Set[str], Field(min_length=4, max_length=4)]
    emotions: Annotated[Set[str], Field(min_length=4, max_length=4)]

    @field_validator("emotions")
    @classmethod
    def check_emotion_types(cls, v: list[str]):
        if not all(keyword.lower().strip() in DEFAULT_EMOTION_LABELS for keyword in v):
            raise ValueError("emotion keywords must be one of the default emotion card set.")
        else:
            return v