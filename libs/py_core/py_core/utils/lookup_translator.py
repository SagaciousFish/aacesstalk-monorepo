import csv
from contextlib import AbstractContextManager

from time import perf_counter
from typing import TypeAlias
from os import path
import asyncio
import threading

from py_core.utils.models import DictionaryRow
from py_core.system.model import UserLocale
from py_core.utils.vector_db import VectorDB

LookupDictionary: TypeAlias = dict[tuple[str, str], DictionaryRow]

class LookupTranslator(AbstractContextManager):
    __dictionary_loaded = False

    def __init__(self, name: str, dict_filepath: str | None = None,
                 vector_db: VectorDB | None = None, verbose: bool = False):
        self.__name = name
        self.__dictionary: LookupDictionary = dict()
        self.verbose = verbose
        self.__dict_filepath: str | None = dict_filepath

        self.__vector_db = vector_db or VectorDB()

        # Event that signals when loading is finished (thread-safe).
        self._loaded_event = threading.Event()
        self._load_task = None
        try:
            loop = asyncio.get_running_loop()
            self._load_task = loop.create_task(self.load_file_async())
        except RuntimeError:
            # No running loop (tests/CLI); fall back to synchronous load.
            self.load_file()
            # If loaded synchronously, ensure event is set.
            self._loaded_event.set()

    @property
    def vector_db(self) -> VectorDB:
        return self.__vector_db

    def _upsert_in_batches(self, rows: list, batch_size: int = 10):
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            self.__vector_db.upsert(self.__name, batch)

    def load_file(self):
        """
        Synchronous loading of the dictionary from CSV. This method may be called
        from a background thread; it sets the loaded event and flag when finished.
        """
        try:
            if self.__dict_filepath is not None:
                if path.exists(self.__dict_filepath):
                    if self.verbose:
                        print("Loading a dictionary file...")
                    t_start = perf_counter()
                    with open(
                        self.__dict_filepath, mode="r", encoding="utf8", newline=""
                    ) as csvfile:
                        reader = csv.DictReader(
                            csvfile, fieldnames=DictionaryRow.field_names()
                        )
                        next(reader, None)

                        num_lines = 0
                        for row in reader:
                            row_model = DictionaryRow.model_validate(row)

                            if row_model.lookup_key not in self.dictionary:
                                self.__dictionary[row_model.lookup_key] = row_model
                            num_lines += 1

                        rows = [row for _, row in self.__dictionary.items()]
                        self._upsert_in_batches(rows, batch_size=10)

                    t_end = perf_counter()

                    if self.verbose:
                        print(
                            f"File dictionary loading ({num_lines} entries) took {t_end - t_start} sec."
                        )
                else:
                    if self.verbose:
                        print(
                            f"Dictionary file ({self.__dict_filepath}) does not exist. Skip reading."
                        )
            else:
                if self.verbose:
                    print("Dictionary file path was not set.")
        finally:
            # Always mark as loaded (success or failure) so waiters won't block forever.
            self.__dictionary_loaded = True
            self._loaded_event.set()

    async def load_file_async(self):
        """
        Asynchronous wrapper to perform the blocking file loading without blocking the event loop.
        Offloads the synchronous `load_file` to a background thread.
        """
        await asyncio.to_thread(self.load_file)

    def write_to_file(self):
        if self.__dict_filepath is not None:
            if self.verbose:
                print("Write lookup dictionary to file..")

            with open(
                self.__dict_filepath, mode="w", encoding="utf8", newline=""
            ) as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=DictionaryRow.field_names())
                writer.writeheader()

                items = [v for k, v in self.__dictionary.items()]

                items.sort(key=lambda elm: elm.localized)
                items.sort(key=lambda elm: elm.english)
                items.sort(key=lambda elm: elm.category)

                for row_model in items:
                    writer.writerow(row_model.model_dump())

    async def wait_loaded(self, timeout: float | None = None) -> bool:
        """
        Async wait until loading completes. Returns True if loaded before timeout.
        """
        if self.__dictionary_loaded:
            return True
        if self._load_task is not None:
            try:
                await asyncio.wait_for(self._load_task, timeout=timeout)
            except asyncio.TimeoutError:
                return False
            return self.__dictionary_loaded
        # No task — wait on the threading event without blocking the event loop.
        return await asyncio.to_thread(self._loaded_event.wait, timeout)

    def wait_loaded_blocking(self, timeout: float | None = None) -> bool:
        """
        Blocking wait (sync contexts). Returns True if loaded before timeout.
        """
        return self._loaded_event.wait(timeout)

    @property
    def is_loaded(self) -> bool:
        return self.__dictionary_loaded

    @property
    def dictionary(self) -> LookupDictionary:
        return self.__dictionary

    @property
    def size(self) -> int:
        return len(self.__dictionary)

    def _parse_localized(self, localized: str, locale: UserLocale) -> str:
        import orjson

        try:
            print(f"Parsing localized string: {localized}")
            parsed = orjson.loads(localized)
            print(f"Parsed localized string: {parsed}")
            if isinstance(parsed, dict) and locale in parsed:
                return parsed[locale]
            else:
                return "localized"
        except Exception:
            return localized

    def lookup(self, english: str, category: str, locale: UserLocale) -> str | None:
        key = (english, category)
        if key in self.dictionary:
            return self._parse_localized(self.dictionary[key].localized, locale)

    def update(self, english: str, category: str, localized: str):
        row = DictionaryRow(category=category, english=english, localized=localized)
        self.dictionary[(english, category)] = row
        self.__vector_db.upsert(self.__name, row)

    def query_similar_rows(
        self,
        english: str | list[str],
        category: str | None,
        k: int = 5,
        cutout_dist=0.7,
    ) -> list[DictionaryRow]:
        return self.__vector_db.query_similar_rows(
            self.__name, english, category, k, cutout_dist
        )

    def __aenter__(self):
        return self

    def __exit__(self, __exc_type, __exc_value, __traceback):
        self.write_to_file()
