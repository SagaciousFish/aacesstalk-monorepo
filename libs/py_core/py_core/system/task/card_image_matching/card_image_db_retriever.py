from thinc.tests.layers.test_layers_api import width
import json
import asyncio
from csv import DictReader
from time import perf_counter

import re
import numpy
from pandas import DataFrame

from py_core.config import AACessTalkConfig
from py_core.utils.models import CardImageInfo
from py_core.utils.vector_db import VectorDB
from py_core.system.model import CardInfo


class CardImageDBRetriever:
    def __init__(self):
        print("Initialize card image DB retriever.")
        info_list: list[CardImageInfo] = []
        # Read CSV using header row so column names map correctly to CardImageInfo fields.
        # Previously fieldnames=CardImageInfo.model_fields was passed and the header row was skipped
        # which caused values to be read positionally and mismatched (e.g., width got description).
        with open(
            AACessTalkConfig.card_image_table_path, "r", encoding="utf-8", newline=""
        ) as f:
            reader = DictReader(f)
            for row in reader:
                info_list.append(
                    CardImageInfo(
                        id=row["id"],
                        category=row["category"],
                        name_localized=row["name_localized"],
                        name_en=json.loads(row["name_localized"])["en"]
                        if row["name_localized"]
                        else None,
                        width=int(row["width"]),
                        height=int(row["height"]),
                        description=str(row["description"]),
                        description_brief=str(row["description_brief"]),
                        format=row.get("format", None),
                    )
                )

        import unicodedata

        # Build a dict with multiple lookup keys (normalized id, basename, id without extension)
        self.__card_info_dict: dict[str, CardImageInfo] = {}
        for inf in info_list:
            key_norm = unicodedata.normalize("NFC", inf.id)
            if key_norm not in self.__card_info_dict:
                self.__card_info_dict[key_norm] = inf

            # basename: e.g., 'bored.png'
            basename = key_norm.split("/")[-1]
            if basename not in self.__card_info_dict:
                self.__card_info_dict[basename] = inf

            # id without extension: e.g., 'core_cards/bored'
            no_ext = key_norm.rsplit(".", 1)[0]
            if no_ext not in self.__card_info_dict:
                self.__card_info_dict[no_ext] = inf

        self.__card_info_table = DataFrame(data=[inf.model_dump() for inf in info_list])

        embedding_store = numpy.load(AACessTalkConfig.card_image_embeddings_path)
        ids_array = embedding_store["ids"]
        desc_embeddings = embedding_store["emb_desc"]
        name_embeddings = embedding_store["emb_name"]

        # Normalize data to native Python types to satisfy VectorDB API/type checkers
        raw_ids = (
            ids_array.tolist() if hasattr(ids_array, "tolist") else list(ids_array)
        )
        ids_list: list[str] = []
        for v in raw_ids:
            if isinstance(v, (bytes, bytearray)):
                try:
                    ids_list.append(v.decode("utf-8"))
                except Exception:
                    ids_list.append(str(v))
            else:
                ids_list.append(str(v))

        desc_docs: list[str] = [info.description_brief or "" for info in info_list]
        name_docs: list[str] = [
            getattr(info, "name", None) or getattr(info, "name_en", None) or ""
            for info in info_list
        ]

        desc_embeddings_list = [emb.tolist() for emb in desc_embeddings]
        name_embeddings_list = [emb.tolist() for emb in name_embeddings]

        if not (
            len(ids_list)
            == len(info_list)
            == len(desc_embeddings_list)
            == len(name_embeddings_list)
        ):
            print("Warning: mismatch lengths between ids, info_list and embeddings")

        self.__vector_db = VectorDB(
            embedding_model=AACessTalkConfig.multimodal_embedding_model,
            embedding_dimensions=AACessTalkConfig.multimodal_embedding_dimensions,
            use_multimodal=True,
        )

        self.__collection_desc = self.__vector_db.get_collection("card_image_desc")
        self.__collection_desc.add(
            ids=ids_list,
            documents=desc_docs,
            metadatas=[
                info.model_dump(include={"name", "category"}) for info in info_list
            ],
            embeddings=desc_embeddings_list,
        )

        self.__collection_name = self.__vector_db.get_collection("names")
        self.__collection_name.add(
            ids=ids_list,
            documents=name_docs,
            metadatas=[
                info.model_dump(include={"name", "category", "description_brief"})
                for info in info_list
            ],
            embeddings=name_embeddings_list,
        )

    def get_card_image_info(self, id: str)->CardImageInfo:
        return self.__card_info_dict[id]

    def __query_result_to_info_list(self, query_result) -> list[list[tuple[CardImageInfo, float]]]:
        list_length = len(query_result["ids"])

        result = []
        for i in range(list_length):
            if len(query_result["ids"][i]) > 0:
                # Map returned ids to CardImageInfo objects with robust fallbacks to avoid KeyError
                objs = []
                for raw_id in query_result["ids"][i]:
                    # common cases: exact match, NFC normalized, pipe-sep (id|label), strip extension, basename
                    if raw_id in self.__card_info_dict:
                        objs.append(self.__card_info_dict[raw_id])
                        continue

                    import unicodedata

                    norm_id = unicodedata.normalize("NFC", raw_id)
                    if norm_id in self.__card_info_dict:
                        objs.append(self.__card_info_dict[norm_id])
                        continue

                    if "|" in raw_id:
                        candidate = raw_id.split("|", 1)[0]
                        if candidate in self.__card_info_dict:
                            objs.append(self.__card_info_dict[candidate])
                            continue

                    if "." in raw_id and "/" in raw_id:
                        # try removing extension
                        candidate_no_ext = raw_id.rsplit(".", 1)[0]
                        if candidate_no_ext in self.__card_info_dict:
                            objs.append(self.__card_info_dict[candidate_no_ext])
                            continue

                    # try basename without directory
                    basename = raw_id.split("/")[-1]
                    if basename in self.__card_info_dict:
                        objs.append(self.__card_info_dict[basename])
                        continue

                    # If we still don't have a match, log a warning and skip this id
                    print(
                        f"Warning: card image id '{raw_id}' not found in card info dict."
                    )

                distances = [s for s in query_result["distances"][i]]
                # zip will truncate to shortest; ensure objs and distances same length
                if len(objs) != len(distances):
                    # truncate or pad distances as necessary
                    min_len = min(len(objs), len(distances))
                    objs = objs[:min_len]
                    distances = distances[:min_len]

                result.append([(o,d) for o,d in zip(objs, distances)])
            else:
                result.append([])

        return result

    async def query_nearest_card_image_infos(
        self, card_infos: list[CardInfo]
    ) -> list[list[CardImageInfo]]:
        t_start = perf_counter()

        names = [c.label for c in card_infos]
        localized_labels = [c.label_localized for c in card_infos]

        name_result_dict: dict[str, list[CardImageInfo] | None] = {
            name: None for name in names
        }

        # Find exact match of Localized labels.

        localized_name_match_results = self.__card_info_table[
            self.__card_info_table["name_localized"].isin(localized_labels)
        ]
        for id in localized_name_match_results["id"].tolist():
            match = self.__card_info_dict[id]
            if (
                match.name_en not in name_result_dict
                or name_result_dict[match.name_en] is None
            ):
                name_result_dict[match.name_en] = [match]
            else:
                name_result_dict[match.name_en].append(match)

        # Find exact match of English labels.

        no_name_matched_card_names = [
            name
            for name in names
            if (
                name not in name_result_dict
                or name_result_dict[name] is None
                or len(name_result_dict[name]) == 0
            )
        ]

        name_match_results = self.__collection_name.get(
            where={"name": {"$in": no_name_matched_card_names}}
        )

        for id in name_match_results["ids"]:
            card_image_info = self.__card_info_dict[id]
            if name_result_dict.get(card_image_info.name_en) is None:
                name_result_dict[card_image_info.name_en] = [card_image_info]
            else:
                name_result_dict[card_image_info.name_en].append(card_image_info)

        no_name_matched_card_names = [
            name
            for name in names
            if (
                name not in name_result_dict
                or name_result_dict[name] is None
                or len(name_result_dict[name]) == 0
            )
        ]

        print(
            f"{(len(names) - len(no_name_matched_card_names))} cards directly matched corpus."
        )
        if len(no_name_matched_card_names) > 0:
            print(
                f"{len(no_name_matched_card_names)} cards will be matched through vector search..."
            )

            name_query = asyncio.to_thread(self.__collection_name.query, query_texts = no_name_matched_card_names, n_results = 5)
            desc_query = asyncio.to_thread(self.__collection_desc.query, query_texts = no_name_matched_card_names, n_results = 5)

            name_query_results, desc_query_results = await asyncio.gather(name_query, desc_query)

            #name_query_results = self.__collection_name.query(
            #    query_texts=no_name_matched_card_names,
            #    n_results=1
            #)
            name_query_results = self.__query_result_to_info_list(name_query_results)


            #desc_query_results = self.__collection_desc.query(
            #    query_texts=no_name_matched_card_names,
            #    n_results=1
            #)
            desc_query_results = self.__query_result_to_info_list(desc_query_results)


            for i, name in enumerate(no_name_matched_card_names):
                candidates = []

                # Add name query results with distance < 0.5
                if i < len(name_query_results):
                    for cand, distance in name_query_results[i]:
                        if distance < 0.5:
                            candidates.append(cand)

                # Add description query results
                if i < len(desc_query_results):
                    for cand, distance in desc_query_results[i]:
                        if cand not in candidates:
                            candidates.append(cand)

                if len(candidates) == 0:
                    print(
                        f"Warning: No image match found for '{name}' via name or description queries."
                    )
                    name_result_dict[name] = []
                else:
                    name_result_dict[name] = candidates

            # Ensure result contains a list for every original name
            result: list[list[CardImageInfo]] = [
                name_result_dict.get(name)
                if isinstance(name_result_dict.get(name), list)
                else []
                for name in names
            ]

        t_end = perf_counter()
        print(f"Card retrieval took {t_end - t_start} sec.")

        return result