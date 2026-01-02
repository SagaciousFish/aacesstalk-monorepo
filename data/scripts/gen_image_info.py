# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "openai", "pillow", "python-dotenv", "orjson"]
# ///

import os
import json
import re
import time
import argparse
import shutil
import base64
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Tuple
import pandas as pd
from PIL import Image
import openai
from dotenv import load_dotenv
import orjson

# Load environment variables
load_dotenv(Path(__file__).parent / ".env")

# Configure OpenAI client for DashScope
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
DASHSCOPE_BASE_URL = os.getenv(
    "DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
)

if not DASHSCOPE_API_KEY:
    raise ValueError("DASHSCOPE_API_KEY not found in environment variables")

# Create client with proper configuration
client = openai.AsyncOpenAI(api_key=DASHSCOPE_API_KEY, base_url=DASHSCOPE_BASE_URL)

# Base paths
BASE_DIR = Path(__file__).parent.parent
CARDS_DIR = BASE_DIR / "cards"
OUTPUT_DIR = BASE_DIR
CACHE_DIR = BASE_DIR / ".cache" / "gen_image_info"
PROGRESS_FILE = CACHE_DIR / "progress.json"
RESULTS_FILE = CACHE_DIR / "results.json"

# Model configuration
VL_MODEL = "qwen3-vl-plus"


def setup_cache_dir(resume: bool = False):
    """Setup cache directory. Clear if not resuming."""
    if resume and CACHE_DIR.exists():
        print(f"Resuming from cache: {CACHE_DIR}")
        return

    if CACHE_DIR.exists():
        print(f"Clearing cache: {CACHE_DIR}")
        shutil.rmtree(CACHE_DIR)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def save_progress(results: List[Dict[str, Any]]):
    """Save progress to cache files."""
    processed_ids = [r["translation"]["id"] for r in results]
    progress_data = {"processed_ids": processed_ids, "timestamp": time.time()}

    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress_data, f, indent=2, ensure_ascii=False)

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)


def load_progress() -> tuple[List[str], List[Dict[str, Any]]]:
    """Load progress from cache files."""
    if not PROGRESS_FILE.exists() or not RESULTS_FILE.exists():
        return [], []

    try:
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            progress_data = json.load(f)

        with open(RESULTS_FILE, "r", encoding="utf-8") as f:
            results = orjson.loads(f.read())

        return progress_data.get("processed_ids", []), results
    except Exception as e:
        print(f"Error loading progress: {e}")
        return [], []


def clear_cache():
    """Clear all cache files."""
    if CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)
        print(f"Cache cleared: {CACHE_DIR}")


def get_image_info(image_path: Path) -> Dict[str, Any]:
    """Get image dimensions and format (Synchronous - fast enough for metadata)."""
    try:
        with Image.open(image_path) as img:
            return {"format": img.format, "width": img.width, "height": img.height}
    except Exception as e:
        print(f"Error reading image {image_path}: {e}")
        return {"format": None, "width": None, "height": None}


async def encode_image_async(image_path: Path) -> Tuple[str, str]:
    """
    Encode image to base64 and determine MIME type.
    Runs in a thread executor to avoid blocking the asyncio loop.
    """
    loop = asyncio.get_running_loop()

    def _encode():
        with open(image_path, "rb") as f:
            image_data = f.read()

        # Get MIME type
        suffix = image_path.suffix.lower()
        mime_type = f"image/{suffix[1:]}"
        if mime_type == "image/jpg":
            mime_type = "image/jpeg"

        # Encode to base64
        base64_data = base64.b64encode(image_data).decode("utf-8")
        return base64_data, mime_type

    return await loop.run_in_executor(None, _encode)


async def generate_and_evaluate_async(
    image_path: Path,
    category: str,
    name_hint: str = "",
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Combined function to generate description and evaluate quality in one VL call.
    """
    for attempt in range(max_retries + 1):
        try:
            # Use the non-blocking encoder
            base64_data, mime_type = await encode_image_async(image_path)

            prompt = f"""You are an expert in creating communication aids for autistic children. Analyze this image carefully and provide the following in valid JSON format:

1. Identify what the image depicts (in English)
2. Provide accurate translations in multiple languages:
   - English (en)
   - Simplified Chinese (zh)
   - Hong Kong Cantonese (yue)
   - Korean (ko)
3. Provide a detailed description (2-3 sentences) that is:
   - Factually accurate
   - Appropriate for children with autism
   - Free of complex metaphors
4. Provide a brief description (1 sentence) suitable for a communication card

Context: This is a communication card for autistic children. Category: {category}. Suggested name: {name_hint}

After generating the content, evaluate its quality immediately against these criteria:
- Accuracy: Does the name correctly identify what's in the image?
- Completeness: Are descriptions detailed yet concise?
- Clarity: Are descriptions clear and understandable for children?
- Appropriateness: Is content suitable for autistic children?

Return ONLY a valid JSON object with this exact structure:
{{
    "en": "English name",
    "zh": "简体中文名称",
    "yue": "港式粵語名稱",
    "ko": "한국어 이름",
    "description": "Detailed description (2-3 sentences)",
    "description_brief": "Brief description (1 sentence)",
    "needs_inspection": false,
    "reason": ""
}}

Set "needs_inspection" to true ONLY if there are significant issues.
Do not include any other text outside the JSON."""

            response = await client.chat.completions.create(
                model=VL_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_data}"
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                max_tokens=800,
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content.strip()

            try:
                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    content = json_match.group(0)

                result = orjson.loads(content)

                return {
                    "name_en": result.get("en", "").strip(),
                    "name_zh": result.get("zh", "").strip(),
                    "name_yue": result.get("yue", "").strip(),
                    "name_ko": result.get("ko", "").strip(),
                    "description": result.get("description", "").strip(),
                    "description_brief": result.get("description_brief", "").strip(),
                    "needs_inspection": bool(result.get("needs_inspection", False)),
                    "inspection_reason": result.get("reason", "").strip(),
                    "description_src": VL_MODEL,
                    "raw_response": content,
                }

            except Exception as parse_error:
                print(
                    f"\nError parsing JSON for {image_path.name} (attempt {attempt + 1}/{max_retries + 1}): {parse_error}"
                )
                if attempt == max_retries:
                    raise parse_error
                continue

        except Exception as e:
            # Handle rate limits specifically
            if "429" in str(e) or "rate limit" in str(e).lower():
                wait_time = 2 ** (attempt + 1)
                print(
                    f"\nRate limit hit for {image_path.name} (attempt {attempt + 1}/{max_retries + 1}), waiting {wait_time}s..."
                )
                await asyncio.sleep(wait_time)
            elif attempt == max_retries:
                # Fallback after max retries
                return {
                    "name_en": name_hint,
                    "name_zh": name_hint,
                    "name_yue": name_hint,
                    "name_ko": name_hint,
                    "description": f"Error: {e}",
                    "description_brief": "Error processing",
                    "needs_inspection": True,
                    "inspection_reason": f"Processing failed: {str(e)}",
                    "description_src": "error",
                    "raw_response": str(e),
                }
            else:
                print(
                    f"\nError generating description for {image_path.name} (attempt {attempt + 1}/{max_retries + 1}): {e}"
                )
                await asyncio.sleep(2**attempt)  # Exponential backoff

            continue

    # Should not reach here due to return in loop, but safe fallback
    return {}


async def process_single_card_async(
    image_path: Path,
    card_id: str,
    category: str,
    filename: str,
    img_info: Dict[str, Any],
    name_hint: str,
) -> Dict[str, Any]:
    """Process a single card asynchronously with combined generation and evaluation."""
    desc_info = await generate_and_evaluate_async(image_path, category, name_hint)

    name_localized_dict = {
        "en": desc_info.get("name_en", name_hint),
        "zh": desc_info.get("name_zh", name_hint),
        "yue": desc_info.get("name_yue", name_hint),
        "ko": desc_info.get("name_ko", name_hint),
    }
    name_localized_str = orjson.dumps(name_localized_dict).decode("utf-8")

    translation_entry = {
        "id": filename,
        "category": category,
        "english": desc_info.get("name_en", name_hint),
        "localized": name_localized_str,
        "inspected": False,
    }

    image_info_entry = {
        "id": f"{filename}",
        "category": category,
        "name_localized": name_localized_str,
        "format": img_info["format"],
        "width": img_info["width"],
        "height": img_info["height"],
        "description": desc_info.get("description", ""),
        "description_src": desc_info.get("description_src", ""),
        "description_brief": desc_info.get("description_brief", ""),
        "inspected": False,
        "need_inspection": desc_info.get("needs_inspection", False),
        "inspection_reason": desc_info.get("inspection_reason", ""),
        "raw_response": desc_info.get("raw_response", ""),
    }

    return {"translation": translation_entry, "image_info": image_info_entry}


async def process_directory_async(
    items: List[Dict[str, Any]],
    processed_ids: List[str],
    results: List[Dict[str, Any]],
    rps: float,
    rpm: int,
    is_core_cards: bool = False,
) -> List[Dict[str, Any]]:
    """
    OPTIMIZED: Uses asyncio.as_completed for true concurrency.
    """
    start_time = time.time()
    processed_count = 0
    skipped_count = 0

    # Filter items to process
    tasks_to_create = []
    for item in items:
        if item["id"] in processed_ids:
            skipped_count += 1
            continue

        if not item["image_path"].exists():
            print(f"\nImage not found: {item['image_path']}")
            continue

        # Get basic info synchronously (fast enough)
        img_info = get_image_info(item["image_path"])

        tasks_to_create.append({
            "image_path": item["image_path"],
            "card_id": item["id"],
            "category": item["category"],
            "filename": item["filename"],
            "img_info": img_info,
            "name_hint": item.get("name_hint", ""),
        })

    total_tasks = len(tasks_to_create)
    print(f"\nProcessing {total_tasks} new items (Skipped: {skipped_count})...")

    if total_tasks == 0:
        return results

    # Semaphore for concurrency limiting
    # Use min(rps, rpm/60) but cap safely
    concurrency = int(min(rps, rpm / 60))
    if concurrency < 1:
        concurrency = 1

    print(f"Starting with concurrency: {concurrency}")
    semaphore = asyncio.Semaphore(concurrency)

    # Worker wrapper handles semaphore logic
    async def worker(task_data):
        async with semaphore:
            return await process_single_card_async(
                image_path=task_data["image_path"],
                card_id=task_data["card_id"],
                category=task_data["category"],
                filename=task_data["filename"],
                img_info=task_data["img_info"],
                name_hint=task_data["name_hint"],
            )

    # Launch all tasks
    pending_tasks = [worker(t) for t in tasks_to_create]

    # Process as they finish
    for coroutine in asyncio.as_completed(pending_tasks):
        try:
            result = await coroutine
            results.append(result)
            processed_ids.append(result["translation"]["id"])
            processed_count += 1

            # Save progress periodically
            if processed_count % 10 == 0:
                save_progress(results)

            # Update Progress Bar
            elapsed = time.time() - start_time
            avg_time = elapsed / processed_count if processed_count > 0 else 0
            remaining = max(0, (total_tasks - processed_count) * avg_time)
            eta_minutes = remaining / 60
            progress = (
                (processed_count + skipped_count) / (total_tasks + skipped_count) * 100
            )

            # Calculate actual throughput
            current_rps = processed_count / elapsed if elapsed > 0 else 0

            print(
                f"\rProgress: [{processed_count + skipped_count}/{total_tasks + skipped_count}] "
                f"{progress:.1f}% | ETA: {eta_minutes:.1f} min | Speed: {current_rps:.2f} rps",
                end="",
                flush=True,
            )

        except Exception as e:
            print(f"\nError in processing: {e}")

    print()  # End line
    return results


async def prepare_core_cards_data() -> List[Dict[str, Any]]:
    """Prepare core cards data from metadata file."""
    metadata_file = CARDS_DIR / "core_cards" / "_metadata.json"

    if not metadata_file.exists():
        print(f"Metadata file not found: {metadata_file}")
        return []

    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata_list = json.load(f)

    items = []
    for item in metadata_list:
        image_path = CARDS_DIR / item["image"]
        items.append({
            "id": item["id"],
            "image_path": image_path,
            "category": item["category"],
            "filename": item["image"],
            "name_hint": item.get("label", ""),
        })

    return items


async def prepare_extra_cards_data() -> List[Dict[str, Any]]:
    """Prepare extra cards data by scanning directory."""
    extra_cards_dir = CARDS_DIR / "extra_cards"

    if not extra_cards_dir.exists():
        print(f"Extra cards directory not found: {extra_cards_dir}")
        return []

    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    image_files = [
        p
        for p in extra_cards_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in image_extensions
    ]

    items = []
    for image_path in image_files:
        relative_path = image_path.relative_to(CARDS_DIR)
        filename = str(relative_path).replace("\\", "/")
        path_parts = relative_path.parts
        category = path_parts[1] if len(path_parts) >= 2 else "extra"
        file_stem = image_path.stem
        card_id = re.sub(r"[^\w-]", "_", file_stem)
        name = file_stem
        name = re.sub(r"^\d+[a-z]?-?\d*", "", name)

        items.append({
            "id": card_id,
            "image_path": image_path,
            "category": category,
            "filename": filename,
            "name_hint": name,
        })

    return items


async def retry_need_inspection_cards(
    results: List[Dict[str, Any]], rps: float, rpm: int
) -> List[Dict[str, Any]]:
    """Retry processing cards marked as needing inspection."""

    # Identify items needing retry
    retry_indices = []
    for idx, result in enumerate(results):
        if result.get("image_info", {}).get("need_inspection", False):
            retry_indices.append(idx)

    if not retry_indices:
        print("\nNo cards need inspection.")
        return results

    print(f"\n{'=' * 60}")
    print(f"Retrying {len(retry_indices)} cards...")
    print(f"{'=' * 60}")

    concurrency = int(min(rps, rpm / 60))
    if concurrency < 1:
        concurrency = 1
    semaphore = asyncio.Semaphore(concurrency)

    async def retry_worker(idx):
        result = results[idx]
        original_info = result["image_info"]
        original_trans = result["translation"]

        image_path = CARDS_DIR / original_info["id"]
        if not image_path.exists():
            return idx, result  # Can't retry if missing

        async with semaphore:
            try:
                img_info = get_image_info(image_path)
                new_result = await process_single_card_async(
                    image_path=image_path,
                    card_id=original_trans["id"],
                    category=original_trans["category"],
                    filename=original_info["id"],
                    img_info=img_info,
                    name_hint=original_trans["english"],
                )
                return idx, new_result
            except Exception as e:
                print(f"Retry failed for {original_trans['id']}: {e}")
                return idx, result

    # Launch retries concurrently
    pending = [retry_worker(idx) for idx in retry_indices]

    fixed_count = 0
    processed_retry = 0

    for coroutine in asyncio.as_completed(pending):
        idx, new_result = await coroutine
        results[idx] = new_result
        processed_retry += 1

        if not new_result["image_info"].get("need_inspection", False):
            fixed_count += 1

        print(
            f"\rRetried {processed_retry}/{len(retry_indices)} | Fixed: {fixed_count}",
            end="",
            flush=True,
        )

    print(f"\nFinished retries. Fixed {fixed_count} cards.")
    return results


async def main_async():
    """Main async function."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true", help="Resume from previous")
    parser.add_argument("--clear-cache", action="store_true", help="Clear cache")
    parser.add_argument("--rps", type=float, default=18, help="Max requests/sec")
    parser.add_argument("--rpm", type=int, default=1200, help="Max requests/min")
    parser.add_argument(
        "--retry-inspection", action="store_true", help="Retry bad cards"
    )

    args = parser.parse_args()

    total_start_time = time.time()

    if args.clear_cache:
        clear_cache()
        setup_cache_dir(resume=False)
    else:
        setup_cache_dir(resume=args.resume)

    processed_ids = []
    results = []
    if args.resume:
        processed_ids, results = load_progress()
        if processed_ids:
            print(f"Loaded {len(processed_ids)} previously processed cards")

    print("=" * 60)
    print("Starting optimized concurrent processing...")
    print(f"Target: {args.rps} RPS / {args.rpm} RPM")
    print("=" * 60)

    # Process Core
    core_items = await prepare_core_cards_data()
    if core_items:
        print("\n--- Core Cards ---")
        results = await process_directory_async(
            core_items, processed_ids, results, args.rps, args.rpm, is_core_cards=True
        )

    # Process Extra
    extra_items = await prepare_extra_cards_data()
    if extra_items:
        print("\n--- Extra Cards ---")
        results = await process_directory_async(
            extra_items, processed_ids, results, args.rps, args.rpm
        )

    save_progress(results)

    if args.retry_inspection:
        results = await retry_need_inspection_cards(results, args.rps, args.rpm)
        save_progress(results)

    # Generate Output
    print("\nGenerating CSV files...")
    translation_data = [r["translation"] for r in results if "translation" in r]
    image_info_data = [r["image_info"] for r in results if "image_info" in r]

    pd.DataFrame(translation_data).to_csv(
        OUTPUT_DIR / "card_translation_dictionary.csv", index=False, encoding="utf-8"
    )
    pd.DataFrame(image_info_data).to_csv(
        OUTPUT_DIR / "cards_image_info.csv", index=False, encoding="utf-8"
    )

    total_time = time.time() - total_start_time
    print(f"\nDone! Total time: {total_time:.1f}s. Processed {len(results)} cards.")


def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        exit(0)
    except Exception as e:
        print(f"\nCritical error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
