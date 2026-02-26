from os import path, getcwd, makedirs, getenv


class AACessTalkConfig:
    # Text embedding (for text-only scenarios)
    embedding_model = "text-embedding-v4"
    embedding_dimensions = 1024

    # Multimodal embedding (for text + image fused vectors)
    # Uses DashScope qwen3-vl-embedding model
    # Note: API returns 2560 dimensions (max), even when requesting smaller
    multimodal_embedding_model = "qwen3-vl-embedding"
    multimodal_embedding_dimensions = 2560

    dataset_dir_path: str = path.join(getcwd(), "../../data")

    card_translation_dictionary_path: str = path.join(
        dataset_dir_path, "card_translation_dictionary.csv"
    )
    parent_example_translation_dictionary_path: str = path.join(
        dataset_dir_path, "parent_example_translation_dictionary.csv"
    )
    card_image_directory_path: str = path.join(dataset_dir_path, "cards")
    # Dedicated folder for pre-generated WebP variants. Keep WebP images here to be less intrusive
    # and avoid changing the original file layout.
    card_image_webp_directory_path: str = path.join(dataset_dir_path, "cards_webp")
    card_image_table_path: str = path.join(dataset_dir_path, "cards_image_info.csv")
    default_core_card_table_path: str = path.join(
        dataset_dir_path, "default_core_cards.yml"
    )
    default_emotion_card_table_path: str = path.join(
        dataset_dir_path, "default_emotion_cards.yml"
    )
    initial_parent_guides_path: str = path.join(
        dataset_dir_path, "initial_parent_guides.yml"
    )
    card_image_embeddings_path: str = path.join(
        dataset_dir_path, "cards_image_desc_embeddings.npz"
    )

    backend_data_dir = path.join(getcwd(), "../../backend_data")

    database_dir_path: str = path.join(backend_data_dir, "database")

    database_file_path: str = path.join(database_dir_path, "aacesstalk.sqlite3")

    user_data_dir_path: str = path.join(backend_data_dir, "user_data/")

    cache_dir_path: str = path.join(backend_data_dir, "cache")

    voiceover_cache_dir_path: str = path.join(cache_dir_path, "voiceover")

    public_base_url: str | None = getenv("PUBLIC_BASE_URL")

    @classmethod
    def get_user_defined_card_dir_path(
        cls, user_id: str, make_if_not_exist: bool = False
    ) -> str:
        p = path.join(cls.user_data_dir_path, user_id, "cards")
        if not path.exists(p) and make_if_not_exist is True:
            makedirs(p)
        return p

    @classmethod
    def get_turn_audio_recording_dir_path(
        cls, user_id: str, make_if_not_exist: bool = False
    ) -> str:
        p = path.join(cls.user_data_dir_path, user_id, "audio")
        if not path.exists(p) and make_if_not_exist is True:
            makedirs(p)
        return p

    @classmethod
    def get_free_topic_image_dir_path(
        cls, user_id: str, make_if_not_exist: bool = False
    ) -> str:
        p = path.join(cls.user_data_dir_path, user_id, "freetopic")
        if not path.exists(p) and make_if_not_exist is True:
            makedirs(p)
        return p