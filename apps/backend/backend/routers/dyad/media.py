from os import path
from time import perf_counter
from typing import Annotated
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    Form,
    Request,
    Response,
    status,
)
from fastapi.responses import FileResponse
from py_core.system.model import CardIdentity
from pydantic import BaseModel
from backend.crud.media import get_free_topic_image
from backend.database import with_db_session
from py_database.database import AsyncSession
from py_database.model import DyadORM, ChildCardRecommendationResultORM
from sqlmodel import select
from py_core.utils.speech import ClovaVoice, ClovaVoiceParams
from py_core.utils.speech.dashscope_audio import DashscopeQwenTTS
from py_core.system.task.card_image_matching import CardType, CardImageMatcher, CardImageMatching
from py_core.system.storage import UserStorage
from py_core.config import AACessTalkConfig
import mimetypes

from backend.routers.dyad.common import get_card_image_matcher, get_signed_in_dyad_orm, get_user_storage
from backend.routers.errors import ErrorType


router = APIRouter()

voice_engine = DashscopeQwenTTS()

@router.get("/voiceover", response_class=FileResponse)
async def get_voiceover(
    card_id: str,
    recommendation_id: str,
    dyad_orm: Annotated[DyadORM, Depends(get_signed_in_dyad_orm)],
    db: Annotated[AsyncSession, Depends(with_db_session)],
):
    result = await db.get(ChildCardRecommendationResultORM, recommendation_id)
    if result is not None:
        recommendation = result.to_data_model()
        card = recommendation.find_card_by_id(card_id)
        if card is not None:
            return FileResponse(
                await voice_engine.create_voice(
                    card.label_localized,
                    dyad_orm.locale,
                )
            )

    raise HTTPException(status_code=400, detail="NoSuchCard")


class CardImageMatchingResult(BaseModel):
    matchings: list[CardImageMatching]


@router.get(
    "/match_card_images/{recommendation_id}", response_model=CardImageMatchingResult
)
async def match_card_images(
    recommendation_id: str,
    db: Annotated[AsyncSession, Depends(with_db_session)],
    dyad_orm: Annotated[DyadORM, Depends(get_signed_in_dyad_orm)],
    image_matcher: Annotated[CardImageMatcher, Depends(get_card_image_matcher)],
):
    t_start = perf_counter()
    card_recommendation = await db.get(
        ChildCardRecommendationResultORM, recommendation_id
    )
    card_recommendation = card_recommendation.to_data_model()
    matches = await image_matcher.match_card_images(
        card_recommendation.cards,
        dyad_orm.parent_type,
        dyad_orm.child_gender,
        locale=dyad_orm.locale,
    )
    t_end = perf_counter()
    print(f"Card matching for {recommendation_id} took {t_end - t_start} sec.")
    return CardImageMatchingResult(matchings=matches)


@router.get("/card_image", response_class=FileResponse)
async def get_card_image(
    card_type: CardType,
    image_id: str,
    dyad_orm: Annotated[DyadORM, Depends(get_signed_in_dyad_orm)],
    image_matcher: Annotated[CardImageMatcher, Depends(get_card_image_matcher)],
    request: Request,
):
    t_start = perf_counter()

    raw_path = await image_matcher.get_card_image_filepath(
        card_type, image_id, dyad_orm.parent_type, dyad_orm.child_gender
    )

    accept_header = request.headers.get("accept", "")

    # If client accepts webp, check the dedicated webp directory first (non-intrusive)
    chosen_path = None
    chosen_mime = None
    if (
        "image/webp" in accept_header
        and AACessTalkConfig.card_image_webp_directory_path
    ):
        try:
            rel = path.relpath(raw_path, AACessTalkConfig.card_image_directory_path)
        except Exception:
            rel = None

        if rel and not rel.startswith(".."):
            webp_candidate = path.join(
                AACessTalkConfig.card_image_webp_directory_path,
                path.splitext(rel)[0] + ".webp",
            )
            if path.exists(webp_candidate):
                chosen_path = webp_candidate
                chosen_mime = "image/webp"

    # If we didn't find a webp in dedicated folder, fall back to checking the original path and common extensions
    if chosen_path is None:
        # Helper: generate candidate paths in prioritized order
        base_root, base_ext = path.splitext(raw_path)

        candidates = []
        # Prefer WebP sibling as a next option
        if "image/webp" in accept_header:
            candidates.append(base_root + ".webp")

        # If raw path had an extension, try that exact file first
        if base_ext:
            candidates.append(raw_path)
            # also try replacing with other common extensions if exact file missing
            for ext in [".png", ".jpg", ".jpeg", ".gif", ".avif"]:
                if ext != base_ext.lower():
                    candidates.append(base_root + ext)
        else:
            # No extension on raw path: try common extensions (PNG first)
            for ext in [".png", ".jpg", ".jpeg", ".gif", ".avif"]:
                candidates.append(raw_path + ext)

        # Ensure uniqueness while keeping order
        seen = set()
        candidates_unique = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                candidates_unique.append(c)

        for p in candidates_unique:
            if path.exists(p):
                chosen_path = p
                chosen_mime = mimetypes.guess_type(p)[0] or "application/octet-stream"
                break

        # As a very last fallback, if raw_path itself exists, use it
        if chosen_path is None and path.exists(raw_path):
            chosen_path = raw_path
            chosen_mime = (
                mimetypes.guess_type(raw_path)[0] or "application/octet-stream"
            )

        if chosen_path is None:
            raise HTTPException(status_code=404)

    # Cache policy: long for stock/static, shorter for custom
    if card_type in (CardType.stock, CardType.static):
        cache_control = "public, max-age=31536000, immutable"
    else:
        cache_control = "public, max-age=604800, immutable"

    mtime = int(path.getmtime(chosen_path))
    size = path.getsize(chosen_path)
    etag = f'W/"{mtime}-{size}"'

    headers = {"Cache-Control": cache_control, "ETag": etag}
    if_none_match = request.headers.get("if-none-match")
    if if_none_match == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)

    t_end = perf_counter()
    print(f"Serving image request card_type={card_type} image_id={image_id} -> {chosen_path} ({chosen_mime}) size={size} took {t_end - t_start} sec.")

    return FileResponse(chosen_path, media_type=chosen_mime, headers=headers)


@router.get('/freetopic', response_class=FileResponse)
async def _get_free_topic_image(detail_id: str, user_storage: Annotated[UserStorage, Depends(get_user_storage)]):
    return await get_free_topic_image(detail_id, user_storage)


@router.get("/parent/message/audio/{dyad_id}/{file_name}")
async def get_parent_message_audio(
    dyad_id: str,
    file_name: str,
) -> FileResponse:
    file_path = path.join(
        AACessTalkConfig.get_turn_audio_recording_dir_path(
            dyad_id, make_if_not_exist=False
        ),
        file_name,
    )
    if not path.exists(file_path):
        raise HTTPException(status_code=404, detail=ErrorType.MissingAudioFile)

    # Serve file efficiently and support range requests
    return FileResponse(path=file_path, media_type="audio/wav", filename=file_name)