#!/usr/bin/env python3
#
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pillow>=12.1.0",
# ]
# ///

"""Generate WebP variants for images in the card image directory.

Writes files to AACessTalkConfig.card_image_webp_directory_path keeping relative structure.
Usage:
  python scripts/generate_card_webp.py --quality 80 --dry-run
"""

from __future__ import annotations
import argparse
from pathlib import Path
from typing import Tuple

try:
    from PIL import Image

    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False


COMMON_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"}


def find_source_images(src_dir: Path):
    for p in src_dir.rglob("*"):
        if (
            p.is_file()
            and p.suffix.lower() in COMMON_EXTS
            and p.suffix.lower() != ".webp"
        ):
            yield p


def make_target_path(src: Path, src_root: Path, dst_root: Path) -> Path:
    rel = src.relative_to(src_root)
    return dst_root.joinpath(rel.with_suffix(".webp"))


def convert_pillow(src: Path, dst: Path, quality: int) -> Tuple[bool, int, int]:
    # returns (converted, src_size, dst_size)
    try:
        im = Image.open(src)
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
        dst.parent.mkdir(parents=True, exist_ok=True)
        # Pillow needs libwebp; may raise error if not available
        im.save(dst, format="WEBP", quality=quality, method=6)
        return True, src.stat().st_size, dst.stat().st_size
    except Exception as e:
        print(f"Failed to convert {src}: {e}")
        return False, src.stat().st_size if src.exists() else 0, 0


def main():
    folder = Path("./").absolute().parent

    parser = argparse.ArgumentParser()
    parser.add_argument("--quality", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--src", type=str, default=str(folder / "cards"))
    parser.add_argument("--dst", type=str, default=str(folder / "cards_webp"))
    args = parser.parse_args()

    src_root = Path(args.src)
    dst_root = Path(args.dst)

    if not src_root.exists():
        raise SystemExit(f"Source directory does not exist: {src_root}")

    if args.dry_run:
        print(
            f"Dry run: scanning {src_root} for images to convert to webp (would write to {dst_root})"
        )
    else:
        dst_root.mkdir(parents=True, exist_ok=True)

    converted = 0
    skipped = 0
    total_src_bytes = 0
    total_dst_bytes = 0

    for src in find_source_images(src_root):
        dst = make_target_path(src, src_root, dst_root)
        # Skip if target exists and is not smaller than source
        if dst.exists():
            skipped += 1
            continue

        total_src_bytes += src.stat().st_size

        if not PIL_AVAILABLE:
            print(
                "Pillow not available; skipping conversion. Install Pillow with webp support to enable conversion."
            )
            break

        if args.dry_run:
            print(f"Would convert {src} -> {dst}")
            converted += 1
            continue

        ok, s, d = convert_pillow(src, dst, args.quality)
        if ok:
            converted += 1
            total_dst_bytes += d
        else:
            skipped += 1

    print(f"Converted: {converted}, Skipped: {skipped}")
    if total_src_bytes > 0 and total_dst_bytes > 0:
        print(
            f"Total src bytes: {total_src_bytes}, total dst bytes: {total_dst_bytes}, savings: {total_src_bytes - total_dst_bytes} bytes"
        )


if __name__ == "__main__":
    main()
