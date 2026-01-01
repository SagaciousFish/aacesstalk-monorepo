# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "openai", "pillow", "python-dotenv", "tqdm", "orjson", "aiohttp", "asyncio"]
# ///

import os
import json
import re
import time
import argparse
import shutil
import asyncio
from pathlib import Path
from typing import List, Dict, Any
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

client = openai.OpenAI(api_key=DASHSCOPE_API_KEY, base_url=DASHSCOPE_BASE_URL)

# Base paths
BASE_DIR = Path(__file__).parent.parent
CARDS_DIR = BASE_DIR / "cards"
OUTPUT_DIR = BASE_DIR
CACHE_DIR = BASE_DIR / ".cache" / "gen_image_info"
PROGRESS_FILE = CACHE_DIR / "progress.json"
RESULTS_FILE = CACHE_DIR / "results.json"


def setup_cache_dir(resume: bool = False):
    """Setup cache directory. Clear if not resuming."""
    if resume and CACHE_DIR.exists():
        print(f"Resuming from cache: {CACHE_DIR}")
    elif CACHE_DIR.exists():
        print(f"Clearing cache: {CACHE_DIR}")
        shutil.rmtree(CACHE_DIR)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def save_progress(results: List[Dict[str, Any]]):
    """Save progress to cache files."""
    # Extract processed_ids from results
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
            results = json.load(f)

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
    """Get image dimensions and format."""
    try:
        with Image.open(image_path) as img:
            return {"format": img.format, "width": img.width, "height": img.height}
    except Exception as e:
        print(f"Error reading image {image_path}: {e}")
        return {"format": None, "width": None, "height": None}


async def evaluate_quality_async(
    image_path: Path, card_data: Dict[str, Any], max_retries: int = 2
) -> Dict[str, Any]:
    """Evaluate the quality of generated data using double pass approach with retry."""
    for attempt in range(max_retries):
        try:
            import base64

            # Read image and encode as base64
            with open(image_path, "rb") as f:
                image_data = f.read()

            # Get MIME type
            mime_type = f"image/{image_path.suffix[1:].lower()}"
            if mime_type == "image/jpg":
                mime_type = "image/jpeg"

            # Encode to base64
            base64_data = base64.b64encode(image_data).decode("utf-8")

            # Create evaluation prompt
            prompt = f"""Evaluate the quality of the following generated data for this image.

Generated Data:
- English Name: {card_data.get("name_en", "")}
- Chinese Name: {card_data.get("name_zh", "")}
- Korean Name: {card_data.get("name_ko", "")}
- Description: {card_data.get("description", "")}
- Brief Description: {card_data.get("description_brief", "")}

Context: This is a communication card for autistic children.

Evaluate the following criteria:
1. Accuracy: Does the name correctly identify what's in the image?
2. Completeness: Are the descriptions detailed and accurate?
3. Clarity: Are the descriptions clear and easy to understand for children?
4. Translation Quality: Are the translations accurate and natural?

Return ONLY a JSON object:
{{
    "needs_inspection": true/false,
    "reason": "Brief explanation of why inspection is needed (if applicable)"
}}

Set needs_inspection to true if there are significant issues with accuracy, completeness, clarity, or translation quality."""

            # Call Qwen Vision model for evaluation
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model="qwen-vl-max",
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
                max_tokens=500,
                temperature=0.1,
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON response
            try:
                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    content = json_match.group(0)

                result = orjson.loads(content)
                return {
                    "needs_inspection": result.get("needs_inspection", False),
                    "reason": result.get("reason", "")
                }
            except Exception as parse_error:
                print(
                    f"\nError parsing evaluation JSON (attempt {attempt + 1}/{max_retries}): {parse_error}"
                )
                if attempt == max_retries - 1:
                    return {"needs_inspection": False, "reason": "Parse error"}  # Default to no inspection if all retries fail
                continue
        except Exception as e:
            print(
                f"\nError evaluating quality for {image_path} (attempt {attempt + 1}/{max_retries}): {e}"
            )
            if attempt == max_retries - 1:
                return {"needs_inspection": False, "reason": str(e)}  # Default to no inspection if all retries fail
            await asyncio.sleep(2**attempt)  # Exponential backoff

    return {"needs_inspection": False, "reason": "Max retries exceeded"}


async def generate_image_description_async(
    image_path: Path, category: str, name_hint: str = "", max_retries: int = 3
) -> Dict[str, Any]:
    """Generate image description and translations using Qwen Vision model asynchronously with retry."""
    for attempt in range(max_retries):
        try:
            import base64

            # Read image and encode as base64
            with open(image_path, "rb") as f:
                image_data = f.read()

            # Get MIME type
            mime_type = f"image/{image_path.suffix[1:].lower()}"
            if mime_type == "image/jpg":
                mime_type = "image/jpeg"

            # Encode to base64
            base64_data = base64.b64encode(image_data).decode("utf-8")

            # Create prompt for JSON response
            prompt = f"""Analyze this image and provide the following information in JSON format:

1. Identify what the image depicts (in English)
2. Provide translations in multiple languages: English, Simplified Chinese (zh), Hong Kong Cantonese (yue), Korean (ko)
3. Provide a detailed description (2-3 sentences)
4. Provide a brief description (1 sentence)

Context: This is a communication card for autistic children. Category: {category}. Name hint: {name_hint}

Return ONLY a valid JSON object with this structure:
{{
    "en": "English name",
    "zh": "简体中文名称",
    "yue": "港式粵語名稱",
    "ko": "한국어 이름",
    "description": "Detailed description of the image (2-3 sentences)",
    "description_brief": "Brief description (1 sentence)"
}}

Do not include any other text outside the JSON."""

            # Call Qwen Vision model with async
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model="qwen-vl-max",
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
                max_tokens=1000,
                temperature=0.3,
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON response
            try:
                # Try to extract JSON from response
                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    content = json_match.group(0)

                result = orjson.loads(content)

                return {
                    "name_en": result.get("en", ""),
                    "name_zh": result.get("zh", ""),
                    "name_yue": result.get("yue", ""),
                    "name_ko": result.get("ko", ""),
                    "description": result.get("description", ""),
                    "description_brief": result.get("description_brief", ""),
                    "description_src": "qwen-vl-max",
                    "raw_response": content,
                }
            except Exception as parse_error:
                print(
                    f"\nError parsing JSON for {image_path} (attempt {attempt + 1}/{max_retries}): {parse_error}"
                )
                if attempt == max_retries - 1:
                    # Fallback: try to extract information from text
                    return {
                        "name_en": name_hint,
                        "name_zh": name_hint,
                        "name_yue": name_hint,
                        "name_ko": name_hint,
                        "description": content,
                        "description_brief": content[:200],
                        "description_src": "qwen-vl-parse-error",
                        "raw_response": content,
                    }
                continue
        except Exception as e:
            print(
                f"\nError generating description for {image_path} (attempt {attempt + 1}/{max_retries}): {e}"
            )
            if attempt == max_retries - 1:
                return {
                    "name_en": name_hint,
                    "name_zh": name_hint,
                    "name_yue": name_hint,
                    "name_ko": name_hint,
                    "description": "",
                    "description_brief": "",
                    "description_src": "error",
                    "raw_response": str(e),
                }
            await asyncio.sleep(2**attempt)  # Exponential backoff

    return {
        "name_en": name_hint,
        "name_zh": name_hint,
        "name_yue": name_hint,
        "name_ko": name_hint,
        "description": "",
        "description_brief": "",
        "description_src": "error",
        "raw_response": "Max retries exceeded",
    }


async def process_core_cards_async(
    processed_ids: List[str], results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Process core_cards directory with _metadata.json asynchronously."""
    metadata_file = CARDS_DIR / "core_cards" / "_metadata.json"

    if not metadata_file.exists():
        print(f"Metadata file not found: {metadata_file}")
        return results

    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata_list = json.load(f)

    start_time = time.time()
    processed_count = 0
    skipped_count = 0

    print(f"\nProcessing {len(metadata_list)} core cards...")
    if processed_ids:
        print(f"Found {len(processed_ids)} previously processed cards")

    # Filter out already processed cards
    tasks = []
    for item in metadata_list:
        card_id = item["id"]

        # Skip if already processed
        if card_id in processed_ids:
            skipped_count += 1
            continue

        image_path = CARDS_DIR / item["image"]

        if not image_path.exists():
            print(f"\nImage not found: {image_path}")
            continue

        # Get image info
        img_info = get_image_info(image_path)

        # Create task for async processing
        task_data = {
            "item": item,
            "image_path": image_path,
            "img_info": img_info,
            "card_id": card_id,
        }
        tasks.append(task_data)

    # Process in batches with concurrency limit
    batch_size = 10  # Process 10 images concurrently
    total_tasks = len(tasks)

    for i in range(0, total_tasks, batch_size):
        batch = tasks[i : i + batch_size]

        # Create async tasks for this batch
        async_tasks = []
        for task_data in batch:
            item = task_data["item"]
            image_path = task_data["image_path"]
            img_info = task_data["img_info"]
            card_id = task_data["card_id"]

            # Generate description and evaluate
            async_task = process_single_card_async(
                image_path=image_path,
                card_id=card_id,
                category=item["category"],
                filename=item["image"],
                img_info=img_info,
                name_hint=item.get("label", ""),
            )
            async_tasks.append(async_task)

        # Execute batch
        batch_results = await asyncio.gather(*async_tasks, return_exceptions=True)

        # Process results
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"\nError in batch processing: {result}")
                continue

            results.append(result)
            processed_ids.append(result["translation"]["id"])
            processed_count += 1

        # Save progress after each batch
        save_progress(results)

        # Rate limiting: small delay between batches to avoid API rate limits
        if i + batch_size < total_tasks:
            await asyncio.sleep(1)  # 1 second delay between batches

        # Calculate progress and ETA
        elapsed = time.time() - start_time
        avg_time = elapsed / processed_count if processed_count > 0 else 0
        remaining = (total_tasks - processed_count) * avg_time
        eta_minutes = remaining / 60

        # Update progress
        progress = (processed_count + skipped_count) / len(metadata_list) * 100
        current_idx = processed_count + skipped_count
        print(
            f"\rProgress: [{current_idx}/{len(metadata_list)}] {progress:.1f}% | ETA: {eta_minutes:.1f} min | New: {processed_count} | Skipped: {skipped_count}",
            end="",
            flush=True,
        )

    print()  # New line after progress
    return results


async def process_single_card_async(
    image_path: Path,
    card_id: str,
    category: str,
    filename: str,
    img_info: Dict[str, Any],
    name_hint: str,
) -> Dict[str, Any]:
    """Process a single card asynchronously with description generation and evaluation."""
    # Generate description
    desc_info = await generate_image_description_async(image_path, category, name_hint)

    # Create name_localized JSON string
    name_localized_dict = {
        "en": desc_info.get("name_en", name_hint),
        "zh": desc_info.get("name_zh", name_hint),
        "yue": desc_info.get("name_yue", name_hint),
        "ko": desc_info.get("name_ko", name_hint),
    }
    name_localized_str = orjson.dumps(name_localized_dict).decode("utf-8")

    # Evaluate quality
    card_data_for_eval = {
        "name_en": desc_info.get("name_en", ""),
        "name_zh": desc_info.get("name_zh", ""),
        "name_ko": desc_info.get("name_ko", ""),
        "description": desc_info.get("description", ""),
        "description_brief": desc_info.get("description_brief", ""),
    }
    evaluation_result = await evaluate_quality_async(image_path, card_data_for_eval)
    
    # Card translation dictionary entry
    translation_entry = {
        "id": card_id,
        "category": category,
        "english": desc_info.get("name_en", name_hint),
        "localized": desc_info.get("name_ko", name_hint),
        "inspected": False,
    }

    # Card image info entry (filename in id)
    image_info_entry = {
        "id": f"{filename}|{card_id}",  # filename in id
        "category": category,
        "name_localized": name_localized_str,
        "name_en": desc_info.get("name_en", name_hint),
        "name_zh": desc_info.get("name_zh", name_hint),
        "name_yue": desc_info.get("name_yue", name_hint),
        "name_ko": desc_info.get("name_ko", name_hint),
        "format": img_info["format"],
        "width": img_info["width"],
        "height": img_info["height"],
        "description": desc_info.get("description", ""),
        "description_src": desc_info.get("description_src", ""),
        "description_brief": desc_info.get("description_brief", ""),
        "inspected": False,
        "need_inspection": evaluation_result.get("needs_inspection", False),
        "inspection_reason": evaluation_result.get("reason", ""),
    }

    return {"translation": translation_entry, "image_info": image_info_entry}


async def process_extra_cards_async(
    processed_ids: List[str], results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Process extra_cards directory recursively asynchronously."""
    extra_cards_dir = CARDS_DIR / "extra_cards"

    if not extra_cards_dir.exists():
        print(f"Extra cards directory not found: {extra_cards_dir}")
        return results

    # Recursively find all image files
    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    image_files = [
        p
        for p in extra_cards_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in image_extensions
    ]

    if not image_files:
        print("No image files found in extra_cards directory")
        return results

    start_time = time.time()
    processed_count = 0
    skipped_count = 0

    print(f"\nProcessing {len(image_files)} extra cards...")
    if processed_ids:
        print(f"Found {len(processed_ids)} previously processed cards")

    # Prepare tasks
    tasks = []
    for image_path in image_files:
        # Get relative path from CARDS_DIR
        relative_path = image_path.relative_to(CARDS_DIR)
        filename = str(relative_path).replace("\\", "/")

        # Extract category from path (first directory under extra_cards)
        path_parts = relative_path.parts
        if len(path_parts) >= 2:
            category = path_parts[1]  # extra_cards/{category}/...
        else:
            category = "extra"

        # Generate ID from filename (remove extension and special characters)
        file_stem = image_path.stem
        card_id = re.sub(r"[^\w-]", "_", file_stem)

        # Skip if already processed
        if card_id in processed_ids:
            skipped_count += 1
            continue

        # Get image info
        img_info = get_image_info(image_path)

        # Extract name from filename (remove extension and numbers)
        name = file_stem
        # Remove leading numbers (e.g., "13a-01企.jpg" -> "企")
        name = re.sub(r"^\d+[a-z]?-?\d*", "", name)

        # Create task for async processing
        task_data = {
            "image_path": image_path,
            "card_id": card_id,
            "category": category,
            "filename": filename,
            "img_info": img_info,
            "name_hint": name,
        }
        tasks.append(task_data)

    # Process in batches with concurrency limit
    batch_size = 10  # Process 10 images concurrently
    total_tasks = len(tasks)

    for i in range(0, total_tasks, batch_size):
        batch = tasks[i : i + batch_size]

        # Create async tasks for this batch
        async_tasks = []
        for task_data in batch:
            # Generate description and evaluate
            async_task = process_single_card_async(
                image_path=task_data["image_path"],
                card_id=task_data["card_id"],
                category=task_data["category"],
                filename=task_data["filename"],
                img_info=task_data["img_info"],
                name_hint=task_data["name_hint"],
            )
            async_tasks.append(async_task)

        # Execute batch
        batch_results = await asyncio.gather(*async_tasks, return_exceptions=True)

        # Process results
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"\nError in batch processing: {result}")
                continue

            results.append(result)
            processed_ids.append(result["translation"]["id"])
            processed_count += 1

        # Save progress after each batch
        save_progress(results)

        # Rate limiting: small delay between batches to avoid API rate limits
        if i + batch_size < total_tasks:
            await asyncio.sleep(1)  # 1 second delay between batches

        # Calculate progress and ETA
        elapsed = time.time() - start_time
        avg_time = elapsed / processed_count if processed_count > 0 else 0
        remaining = (total_tasks - processed_count) * avg_time
        eta_minutes = remaining / 60

        # Update progress
        progress = (processed_count + skipped_count) / len(image_files) * 100
        current_idx = processed_count + skipped_count
        print(
            f"\rProgress: [{current_idx}/{len(image_files)}] {progress:.1f}% | ETA: {eta_minutes:.1f} min | New: {processed_count} | Skipped: {skipped_count}",
            end="",
            flush=True,
        )

    print()  # New line after progress
    return results


async def main_async():
    """Main async function to process all cards and generate CSV files."""
    parser = argparse.ArgumentParser(
        description="Generate card image information and descriptions"
    )
    parser.add_argument(
        "--resume", action="store_true", help="Resume from previous progress"
    )
    parser.add_argument(
        "--clear-cache", action="store_true", help="Clear cache and start fresh"
    )

    args = parser.parse_args()

    total_start_time = time.time()

    # Setup cache
    if args.clear_cache:
        clear_cache()
        setup_cache_dir(resume=False)
    else:
        setup_cache_dir(resume=args.resume)

    # Load previous progress if resuming
    processed_ids = []
    results = []
    if args.resume:
        processed_ids, results = load_progress()
        if processed_ids:
            print(f"Loaded {len(processed_ids)} previously processed cards")
            # Validate results structure
            if results and not all(
                "translation" in r and "image_info" in r for r in results
            ):
                print(
                    "Warning: Cached results have incompatible structure. Clearing cache..."
                )
                clear_cache()
                setup_cache_dir(resume=False)
                processed_ids = []
                results = []

    print("=" * 60)
    print("Starting to process cards...")
    print("=" * 60)

    # Process core cards
    print("\n[1/2] Processing core_cards...")
    core_start_time = time.time()
    results = await process_core_cards_async(processed_ids, results)
    core_time = time.time() - core_start_time
    print(f"✓ Core cards completed in {core_time:.1f} seconds")

    # Process extra cards
    print("\n[2/2] Processing extra_cards...")
    extra_start_time = time.time()
    results = await process_extra_cards_async(processed_ids, results)
    extra_time = time.time() - extra_start_time
    print(f"✓ Extra cards completed in {extra_time:.1f} seconds")

    # Save final progress
    save_progress(results)

    # Create DataFrames
    print("\nGenerating CSV files...")
    translation_data = [r["translation"] for r in results]
    image_info_data = [r["image_info"] for r in results]

    translation_df = pd.DataFrame(translation_data)
    image_info_df = pd.DataFrame(image_info_data)

    # Save to CSV
    translation_output = OUTPUT_DIR / "card_translation_dictionary.csv"
    image_info_output = OUTPUT_DIR / "cards_image_info.csv"

    translation_df.to_csv(translation_output, index=False, encoding="utf-8")
    image_info_df.to_csv(image_info_output, index=False, encoding="utf-8")

    total_time = time.time() - total_start_time

    # Count core and extra results
    core_results = [
        r for r in results if r["translation"]["category"] in ["core", "emotion"]
    ]
    extra_results = [
        r for r in results if r["translation"]["category"] not in ["core", "emotion"]
    ]

    # Count need_inspection
    need_inspection_count = sum(
        1 for r in results if r["image_info"].get("need_inspection", False)
    )

    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"Total cards processed: {len(results)}")
    print(f"  - Core cards: {len(core_results)}")
    print(f"  - Extra cards: {len(extra_results)}")
    print(f"  - Need inspection: {need_inspection_count}")
    print(f"\nTime elapsed: {total_time:.1f} seconds ({total_time / 60:.1f} minutes)")
    print("\nGenerated files:")
    print(f"  - {translation_output}")
    print(f"  - {image_info_output}")
    print(f"\nCache location: {CACHE_DIR}")
    print("=" * 60)


def main():
    """Entry point for the script."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
