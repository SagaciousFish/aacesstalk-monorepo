from py_core.system.task.card_recommendation.translator import CardTranslator


if __name__ == "__main__":
    print("Testing CardTranslator...")
    card_translator = CardTranslator(None)
    card_translator._CardTranslator__transform_original_word(
        "What is the most interesting thing that I could ever possibly imagine?"
    )
    print("Test completed.")
