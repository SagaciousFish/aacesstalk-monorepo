# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pandas>=2.3.3",
#     "pyyaml>=6.0.3",
#     "orjson>=3.11.5",
# ]
# ///

import pathlib
import pandas as pd
import yaml
from orjson import dumps

def load_cards_info(yaml_path: pathlib.Path, inspected = False) -> pd.DataFrame:
    print(f"Loading cards info from {yaml_path}...")
    df = pd.DataFrame()

    data: list[dict[str, str]] = []
    with open(yaml_path, 'r', encoding='utf8') as f:
        data.extend(yaml.safe_load(f))
        print(f"Loaded {len(data)} items from {yaml_path}")

    records: list[dict[str, str]] = []
    for card in data:
        record = {
            "id": card.get("image", ""),
            "category": card.get("category", ""),
            "english": card.get("label", ""),
            "localized": dumps(card.get("label_localized", "")).decode("utf-8"),
            "inspected": str(inspected),
        }
        records.append(record)

    df = pd.DataFrame.from_records(records)
    return df

if __name__ == "__main__":

    # Configs
    script_dir = pathlib.Path(__file__).parent
    print(f"{script_dir=}")

    default_card_info_dir = script_dir.parent
    print(f"{default_card_info_dir=}")

    core_cards_info_yaml = default_card_info_dir / 'default_core_cards.yml'
    emotion_cards_info_yaml = default_card_info_dir / 'default_emotion_cards.yml'
    dictionary_csv_path = default_card_info_dir / "card_translation_dictionary.csv"

    # Run
    core_cards_df = load_cards_info(core_cards_info_yaml, inspected=True)
    emotion_cards_df = load_cards_info(emotion_cards_info_yaml, inspected=True)

    combined_df = pd.concat([core_cards_df, emotion_cards_df], ignore_index=True)

    combined_df.to_csv(dictionary_csv_path, index=False, encoding="utf8", lineterminator='\n')
    print(f"Combined cards dictionary saved to {dictionary_csv_path}")