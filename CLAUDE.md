# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AACessTalk is an ACM CHI 2025 Best Paper Award-winning research project - a tablet application for fostering communication between minimally verbal autistic children and parents. The monorepo contains:

- **Mobile Client**: React Native (TypeScript)
- **Backend Services**: FastAPI (Python) and Convex (newer architecture)
- **Core Libraries**: Python AI/ML processing, TypeScript shared code
- **Web Apps**: Admin and end-user web dashboards

## Common Commands

### Setup

```bash
npm install
nx run backend:install
npm run setup-js           # Frontend setup
nx run backend:setup       # Backend setup (downloads models, initializes data)
```

### Development

```bash
# Backend (FastAPI)
nx run backend:run-dev     # Development mode
nx run backend:run-prod    # Production mode (Gunicorn)
nx run backend:daemon-dev  # Daemon mode

# Mobile Client (React Native)
nx run client-rn:run-android
nx run client-rn:run-ios

# Convex backend (newer architecture)
npx convex dev             # Start Convex dev server

# Admin Console
nx run backend:admin-console
```

### Testing & Linting

```bash
# Backend
nx run backend:test        # pytest
nx run backend:lint        # ruff check

# Python Core Library
nx run py_core:test
nx run py_core:lint
nx run py_core:test_vector           # Test vector search
nx run py_core:test_card_image_retrieval
nx run py_core:test_clova_voice
nx run py_core:test_asr
nx run py_core:test_corpus_download

# Web Apps (Cypress e2e)
nx run enduser-web:e2e
nx run admin-web:e2e
```

### Python Package Management

Uses **UV** (not Poetry) for Python package management:

```bash
nx run backend:install     # uv sync
nx run backend:add <pkg>   # uv add
nx run backend:remove <pkg>
nx run backend:update      # uv lock --upgrade
```

## Architecture

### Apps Structure

```
apps/
├── backend/              # FastAPI backend (Python)
│   └── backend/         # Main application code
├── client-rn/           # React Native mobile app (primary)
├── client-expo/         # Expo variant (EXPERIMENTAL - not fully integrated with NX)
├── admin-web/           # Admin dashboard (Vite + React)
└── enduser-web/        # End-user web app
```

### Libraries

```
libs/
├── py_core/             # Python AI/ML processing
│   └── py_core/
│       ├── processing_tools/  # Card processing, translation tools
│       └── utils/
│           ├── speech/        # Voice services (CosyVoice, FunASR, CLOVA)
│           └── translate/     # Translation (DeepL, Aliyun)
├── py_database/         # Python database utilities
└── ts-core/            # TypeScript shared code
```

### Backend Architecture

1. **FastAPI** (`apps/backend/`) - Primary Python backend with AI pipelines (original, production-ready)
2. **Convex** (`convex/`) - Newer serverless backend with vector search (actively developed)

### Client-Side Architecture

- **React Native** with Redux Toolkit for state management
- **NativeWind** (Tailwind CSS) for styling
- **MMKV** for local caching (cards, voice)
- Services: `CardCacheManager`, `CardRecommender`, `VoiceCacheManager`, `ImageOptimizer`

### Key Integrations

- **AI**: OpenAI API
- **Voice Synthesis**: CLOVA Voice, CosyVoice (local), Dashscope
- **Speech Recognition**: FunASR Nano (local), CLOVA Speech, Whisper, Aliyun
- **Translation**: DeepL, Aliyun
- **Embedding (Multimodal)**: DashScope qwen3-vl-embedding (Fused mode: text + image → cross-modal retrieval)
- **Embedding (Text)**: OpenAI text-embedding-v4 (for text-only scenarios)
- **Analytics**: PostHog
- **Database**: SQLite (FastAPI), Convex (new backend)

## Environment Configuration

Required API credentials (set in `.env.local` for local development):
- `OPENAI_API_KEY`
- `CLOVA_VOICE_API_KEY`, `CLOVA_VOICE_SECRET`
- `CLOVA_SPEECH_INVOKE_URL`, `CLOVA_SPEECH_SECRET` (Korean)
- `DEEPL_API_KEY` (Korean)
- `DASHSCOPE_API_KEY` - Required for multimodal embedding (qwen3-vl-embedding) and Qwen VL models
- `POSTHOG_API_KEY`, `POSTHOG_HOST` (analytics)

## Experimental/Legacy Content

### Recently Added (Active Development)
- **Convex** (`convex/`) - Newer serverless backend with vector search, added in recent commits
- **client-expo** - Added alongside Convex development, not fully integrated with NX

### OpenSpec Workflow
- **openspec/** - Experimental artifact workflow for change management

### Legacy Architecture
- **FastAPI backend** - Original Python backend with AI pipelines (still primary)

## Important Notes

- Uses **NX** for monorepo management
- Uses **UV** (not Poetry) for Python dependencies
- Uses **Ruff** (not Flake8) for Python linting
- Requires Node.js >= 22 and Python 3.11.8
- Cards support 5 languages: English, Korean, Simplified Chinese, Traditional Chinese, Cantonese
- Local ML models: FunASR Nano (ASR), CosyVoice (TTS) - no API keys needed
