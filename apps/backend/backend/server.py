from py_core.utils.speech.funasr_nano import FunASRNanoSpeechRecognizer
from contextlib import asynccontextmanager
import json
from os import getcwd, path
import os
from time import perf_counter
from py_core.utils.default_cards import inspect_default_card_images


import logging
from fastapi import FastAPI, Request, status, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.database import create_test_dyad, create_test_freetopics, engine
from py_database.database import create_db_and_tables
from backend.routers import dyad, admin
import re
from pathlib import Path
import uuid
import sys
import openai
import winuvloop

winuvloop.install()

openai.api_key = os.getenv("OPENAI_API_KEY")
openai.base_url = os.getenv("OPENAI_BASE_URL")

# Configure root logger only if no handlers exist (avoids conflict with uvicorn)
if not logging.root.handlers:
    logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def server_lifespan(app: FastAPI):
    logger.info("Server launching.")

    app.state.ready = False

    try:
        winuvloop.install()
        logger.info("Using winuvloop event loop policy.")

        inspect_default_card_images()
        logger.info("Default card images inspected.")

        await create_db_and_tables(engine)
        logger.info("Database tables created.")

        await create_test_dyad()
        logger.info("Test dyad created.")

        await create_test_freetopics()
        logger.info("Test free topics created.")

        # await FunASRNanoSpeechRecognizer.initialize_service()

        app.state.ready = True
        logger.info("Service initialization complete.")
    except Exception as e:
        logger.critical(f"Failed to initialize server: {e}", exc_info=True)
        # Re-raising ensures the server doesn't start in a broken state
        raise e

    yield

    # Cleanup logic will come below.
    logger.info("Server shutting down.")


app = FastAPI(lifespan=server_lifespan)

# Setup routers
app.include_router(dyad.router, prefix="/api/v1/dyad")
app.include_router(admin.router, prefix="/api/v1/admin")


@app.head("/api/v1/ping")
def ping():
    return Response(status_code=status.HTTP_204_NO_CONTENT)


##############

asset_path_regex = re.compile(r"\.[a-z0-9]+$", re.IGNORECASE)

ROOT = Path(__file__).resolve().parent
static_frontend_path = ROOT / ".." / ".." / "dist" / "apps" / "admin-web"
print(static_frontend_path)
if path.exists(static_frontend_path):

    @app.get("/{rest_of_path:path}", response_class=HTMLResponse)
    def redirect_frontend_nested_url(*, rest_of_path: str):
        if len(asset_path_regex.findall(rest_of_path)) > 0:
            # This is a static asset file path.
            return FileResponse(path.join(static_frontend_path, rest_of_path))
        else:
            return HTMLResponse(
                status_code=200,
                content=open(path.join(static_frontend_path, "index.html")).read(),
            )

    app.mount(
        "/", StaticFiles(directory=static_frontend_path, html=True), name="static"
    )
    print("Compiled static frontend file path was found. Mount the file.")

##############


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    exc_str = f"{exc}".replace("\n", " ").replace("   ", " ")
    # or logger.error(f'{exc}')
    print(request, exc_str)
    content = {"status_code": 10422, "message": exc_str, "data": None}
    return JSONResponse(
        content=content, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception during {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status_code": 10500,
            "message": "Internal Server Error",
            "detail": str(exc)
            if os.getenv("DEBUG")
            else "An unexpected error occurred.",
        },
    )


# Setup middlewares
origins = [
    "http://localhost:3000",
    "localhost:3000",
    "0.0.0.0:3000",
    "http://0.0.0.0:3000",
    "localhost:4200",
    "http://localhost:4200",
    "localhost:4300",
    "http://localhost:4300",
    "http://localhost:8000",
    "localhost:8000",
]

try:
    allowed_origins = json.loads(os.getenv("ADMIN_WEB_ORIGINS", "[]"))
except json.JSONDecodeError:
    allowed_origins = []

origin_list = allowed_origins or origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-processing-time", "X-request-id", "X-context-id"],
)


@app.middleware("http")
async def global_middleware(request: Request, call_next):
    # 1. Check if service is ready
    # We allow /api/v1/ping to pass through even if not ready so health checks work
    if not getattr(app.state, "ready", False) and request.url.path != "/api/v1/ping":
        return JSONResponse({"detail": "Service initializing"}, status_code=503)

    # 2. Extract or generate IDs
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    context_id = request.headers.get("x-context-id")

    # 3. Process request and measure time
    start_time = perf_counter()
    try:
        response = await call_next(request)
    except Exception as e:
        process_time = perf_counter() - start_time
        logger.error(
            f"Request failed: {request.method} {request.url.path} - Error: {e} ({process_time:.4f}s) [RID: {request_id}]",
            exc_info=True,
        )
        raise e

    process_time = perf_counter() - start_time

    # 4. Inject headers into response
    response.headers["X-processing-time"] = f"{process_time:.4f}"
    response.headers["X-request-id"] = request_id
    if context_id:
        response.headers["X-context-id"] = context_id

    # 5. Log request summary
    if request.url.path != "/api/v1/ping":
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} ({process_time:.4f}s) [RID: {request_id}]"
        )

    return response