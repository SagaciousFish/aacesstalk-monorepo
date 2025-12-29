from time import perf_counter

from chatlib.global_config import GlobalConfig

from py_core.config import AACessTalkConfig

from py_core.utils.lookup_translator import LookupTranslator

print("Starting core metadata dump script...")

GlobalConfig.is_cli_mode = True

print("Loading card translation dictionary...")

card_translator = LookupTranslator("cards", AACessTalkConfig.card_translation_dictionary_path, verbose=True)

print("Card translation dictionary loaded.")

print(card_translator.vector_db.get_collection("cards").count())

print("Querying similar rows for 'Happy' in category 'emotion'...")

cards = card_translator.query_similar_rows(["happy"], "emotion", 4)

print("Similar cards found:")

print([card.english for card in cards])
