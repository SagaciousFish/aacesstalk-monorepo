# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "orjson>=3.11.5",
#     "pyyaml>=6.0.3",
# ]
# ///

import pathlib
import yaml
import orjson


def load_yaml_list(yaml_path: pathlib.Path) -> list[dict]:
    """Load a YAML file that contains a list of records and return a list.
    Returns an empty list if the file contains no data.
    """
    with yaml_path.open("r", encoding="utf8") as f:
        return list(yaml.safe_load(f) or [])


def main() -> None:
    script_dir = pathlib.Path(__file__).parent
    base = script_dir.parent

    core_cards_dir = base / "cards" / "core_cards"
    assert core_cards_dir.exists(), f"Directory not found: {core_cards_dir}"

    metadata_json_path = core_cards_dir / "_metadata.json"

    records: list[dict] = []
    for yaml_path in (base / "default_core_cards.yml", base / "default_emotion_cards.yml"):
        records.extend(load_yaml_list(yaml_path))

    with metadata_json_path.open("wb") as f:
        f.write(orjson.dumps(records, option=orjson.OPT_INDENT_2))


if __name__ == "__main__":
    main()
