import chromadb
from chromadb import EmbeddingFunction, Documents
import chromadb.utils.embedding_functions as ef
from openai import OpenAI

from chatlib.llm.integration import GPTChatCompletionAPI
from chatlib.utils.integration import APIAuthorizationVariableSpecPresets
from chromadb.api.models.Collection import Collection
from numpy import ndarray

from py_core.utils.models import DictionaryRow


class OpenAIEmbeddingFunction(EmbeddingFunction[Documents]):

    def __init__(self, api_key: str, model: str, dimensions: int):
        self.__model = model
        self.__dimensions = dimensions
        self.__client = OpenAI(api_key=api_key)

    def __call__(self, input: Documents):
        result = self.__client.embeddings.create(input=input,
                                 model=self.__model,
                                 dimensions=self.__dimensions
                                 )
        return [datum.embedding for datum in result.data]

class VectorDB:
    def __init__(
        self,
        dir_name: str = "embeddings",
        embedding_model: str = "text-embedding-v4",
        embedding_dimensions: int = 256,
    ):
        #self.__client = chromadb.PersistentClient(path.join(AACessTalkConfig.dataset_dir_path, dir_name))
        self.__client = chromadb.Client()

        print(
            f"OpenAI API KEY: {GPTChatCompletionAPI.get_auth_variable_for_spec(APIAuthorizationVariableSpecPresets.ApiKey)}"
        )

        GPTChatCompletionAPI.assert_authorize()
        api_key = GPTChatCompletionAPI.get_auth_variable_for_spec(
            APIAuthorizationVariableSpecPresets.ApiKey)

        self.__decode = OpenAIEmbeddingFunction(api_key=api_key, model=embedding_model, dimensions=embedding_dimensions)

    def get_collection(self, name: str) -> Collection:
        return self.__client.get_or_create_collection(name, embedding_function=self.__decode)

    def upsert(self, collection: str | Collection, dictionary_row: DictionaryRow | list[DictionaryRow]) -> ndarray | list[ndarray]:

        rows = [dictionary_row] if isinstance(dictionary_row, DictionaryRow) else dictionary_row

        try:
            (collection if isinstance(collection, Collection) else self.get_collection(collection)).upsert(
                ids=[row.id for row in rows],
                metadatas=[row.model_dump(include={"category", "localized"}) for row in rows],
                documents=[row.english for row in rows]
            )
        except Exception as ex:
            print("Erroneous row:", dictionary_row)
            print(ex)
            print("Dictionary initialization error. Try row by row skipping erroneous rows.")

            for row in rows:
                try:
                    (collection if isinstance(collection, Collection) else self.get_collection(collection)).upsert(
                        ids=row.id,
                        metadatas=row.model_dump(include={"category", "localized"}),
                        documents=row.english
                    )
                except Exception as row_ex:
                    print(row_ex)
                    print(f"Skip the erroneous row: {row}")
                    continue


    def query_similar_rows(self, collection: str | Collection, word: str | list[str], category: str | None, k: int = 5, cutout_dist:float = 0.5) -> list[DictionaryRow]:
        #print(f"Query similar cards: {word}, {category}")
        collection_instance = (collection if isinstance(collection, Collection) else self.get_collection(collection))
        query_result = collection_instance.query(
            query_texts=[word] if isinstance(word, str) else word,
            n_results=k,
            where={"category": category} if category is not None else None,
            include=["documents", "metadatas", "distances"],
        )
        print(
            query_result
        )  # inspect distances: smaller == closer (depends on embedding function)

        ids = query_result["ids"][0]
        docs = query_result["documents"][0]
        metas = query_result["metadatas"][0]
        dists = query_result.get("distances", [[]])[0]

        if len(ids) > 0:
            has_dists = len(dists) == len(ids)

            if has_dists:
                pairs = list(zip(ids, docs, metas, dists))
                pairs.sort(key=lambda t: t[3])

                # Apply cutoff: keep only pairs with distance <= cutout_dist
                if cutout_dist is not None:
                    pairs = [p for p in pairs if p[3] <= cutout_dist]

                return [
                    DictionaryRow(
                        id=id,
                        english=doc,
                        category=meta["category"],
                        localized=meta["localized"],
                    )
                    for id, doc, meta, dist in pairs
                ]
            else:
                # No distances available; return in original order
                pairs = list(zip(ids, docs, metas))
                return [
                    DictionaryRow(
                        id=id,
                        english=doc,
                        category=meta["category"],
                        localized=meta["localized"],
                    )
                    for id, doc, meta in pairs
                ]
        else:
            return []
