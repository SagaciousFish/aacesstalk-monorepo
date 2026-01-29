from py_core.system.model import CardCategory, FreeTopicDetail, UserDefinedCardInfo
from py_core.system.storage import UserStorage


class OnMemoryUserStorage(UserStorage):
    """In-memory implementation of UserStorage for tests and local runs.

    Stores the latest-per-(category, label_localized) UserDefinedCardInfo in
    `__user_defined_cards` and keeps a lookup by id in `__user_defined_cards_by_id`.
    All public methods use the inherited `self._lock` for concurrency safety.
    """

    def __init__(self, user_id: str | None):
        super().__init__(user_id)
        self.__user_defined_cards: dict[
            tuple[CardCategory, str], list[UserDefinedCardInfo]
        ] = {}
        self.__user_defined_cards_by_id: dict[str, UserDefinedCardInfo] = {}
        self.__free_topic_details: dict[str, FreeTopicDetail] = {}

    async def register_user_defined_card(self, info: UserDefinedCardInfo):
        """Register or update a user-defined card.

        If an entry with the same `id` already exists, the old entry is removed
        from its (category, label_localized) bucket before inserting the new
        `info`. Uses `label_localized` as the canonical key for queries.
        """
        async with self._lock:
            if info.id not in self.__user_defined_cards_by_id:
                self.__user_defined_cards_by_id[info.id] = info

            # Error handling for label being None
            if info.label is None:
                raise ValueError("Label cannot be None for user defined card")

            # Create a key using category and label_localized
            key = (info.category, info.label)
            list_ref = self.__user_defined_cards.setdefault(key, [])
            list_ref.append(info)
            list_ref.sort(key=lambda i: i.timestamp)

    # Getting all user defined cards, but only the latest for each (category, label_localized)
    async def get_user_defined_cards(self) -> list[UserDefinedCardInfo]:
        async with self._lock:
            return [v[-1] for v in self.__user_defined_cards.values() if v]

    async def query_user_defined_card(self, category: CardCategory, label_localized: str) -> UserDefinedCardInfo | None:
        async with self._lock:
            return self.__user_defined_cards.get((category, label_localized), [None])[
                -1
            ]

    async def get_user_defined_card(self, id: str) -> UserDefinedCardInfo | None:
        async with self._lock:
            return self.__user_defined_cards_by_id.get(id, None)

    async def upsert_free_topic_detail(self, detail: FreeTopicDetail):
        async with self._lock:
            self.__free_topic_details[detail.id] = detail

    async def get_free_topic_details(self) -> list[FreeTopicDetail]:
        async with self._lock:
            return list(self.__free_topic_details.values())

    async def remove_free_topic_detail(self, id: str):
        async with self._lock:
            self.__free_topic_details.pop(id, None)

    async def get_free_topic_detail(self, id: str) -> FreeTopicDetail | None:
        async with self._lock:
            return self.__free_topic_details.get(id, None)

    async def remove_user_defined_card(self, id: str):
        async with self._lock:
            info = self.__user_defined_cards_by_id.pop(id, None)
            if info is None or info.label is None:
                return
            key = (info.category, info.label)
            lst = self.__user_defined_cards.get(key, [])
            self.__user_defined_cards[key] = [i for i in lst if i.id != id]
            if not self.__user_defined_cards[key]:
                del self.__user_defined_cards[key]