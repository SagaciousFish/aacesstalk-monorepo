"""
DashScope Multimodal Embedding Function

Uses Alibaba Cloud DashScope's qwen3-vl-embedding model to generate
multimodal embeddings (fused vectors from text + image).

API Documentation: https://help.aliyun.com/zh/model-studio/embedding#59142691b717x
"""

import os
from typing import List, Dict, Any, Union

import dashscope
from dashscope import MultiModalEmbedding

from py_core.config import AACessTalkConfig


class DashScopeEmbeddingFunction:
    """
    Embedding function using DashScope's multimodal embedding API.

    Supports:
    - Fused mode: text + image -> single vector (for cross-modal retrieval)
    - Independent mode: text only or image only -> separate vectors

    Compatible with ChromaDB's EmbeddingFunction interface.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        dimensions: int | None = None,
    ):
        """
        Initialize the DashScope embedding function.

        Args:
            api_key: DashScope API key. If None, reads from DASHSCOPE_API_KEY env var.
            model: Model name. Defaults to AACessTalkConfig.multimodal_embedding_model
            dimensions: Embedding dimensions. Defaults to AACessTalkConfig.multimodal_embedding_dimensions
        """
        self._api_key = api_key or os.environ.get("DASHSCOPE_API_KEY")
        if not self._api_key:
            raise ValueError(
                "DASHSCOPE_API_KEY not set. Either pass api_key or set DASHSCOPE_API_KEY environment variable."
            )

        self._model = model or AACessTalkConfig.multimodal_embedding_model
        self._dimensions = dimensions or AACessTalkConfig.multimodal_embedding_dimensions

        # Validate dimensions
        supported_dimensions = [2560, 2048, 1536, 1024, 768, 512, 256]
        if self._dimensions not in supported_dimensions:
            raise ValueError(
                f"Unsupported dimensions: {self._dimensions}. "
                f"Supported: {supported_dimensions}"
            )

    def name(self) -> str:
        """Return the name of the embedding function (required by ChromaDB)."""
        return f"dashscope-{self._model}-{self._dimensions}d"

    def embed_query(self, input: str) -> List[float]:
        """
        Embed a single query text (required by ChromaDB).

        Args:
            input: Query text string (or object from ChromaDB)

        Returns:
            Embedding vector
        """
        # Handle ChromaDB passing various types - convert to string
        text = str(input) if not isinstance(input, str) else input
        return self._generate_embeddings([{"text": text}])[0]

    def embed_documents(self, input: List[str]) -> List[List[float]]:
        """
        Embed multiple documents (required by ChromaDB).

        Args:
            input: List of text strings

        Returns:
            List of embedding vectors
        """
        # Handle ChromaDB passing various types - convert to strings
        texts = [str(t) if not isinstance(t, str) else t for t in input]
        input_data = [{"text": text} for text in texts]
        return self._generate_embeddings(input_data)

    def __call__(self, input: List[str]) -> List[List[float]]:
        """
        Generate embeddings for text inputs (ChromaDB compatible).

        Args:
            input: List of text strings (ChromaDB passes strings, not dicts)

        Returns:
            List of embedding vectors
        """
        # ChromaDB passes list of strings, convert to dict format for DashScope API
        input_data = [{"text": text} for text in input]
        return self._generate_embeddings(input_data)
        """
        Generate embeddings for the given inputs.

        Args:
            input: List of dicts with keys:
                - text: str (optional) - text content
                - image: str (optional) - image URL or base64

        Returns:
            List of embedding vectors

        Example:
            # Fused mode (text + image)
            embeddings = func([{"text": "a cat", "image": "https://example.com/cat.jpg"}])

            # Text only
            embeddings = func([{"text": "a cat"}])

            # Image only
            embeddings = func([{"image": "https://example.com/cat.jpg"}])
        """
        return self._generate_embeddings(input)

    def _generate_embeddings(self, input: List[Dict[str, Any]]) -> List[List[float]]:
        """
        Call DashScope API to generate embeddings.
        """
        response = MultiModalEmbedding.call(
            api_key=self._api_key,
            model=self._model,
            input=input,
            dimensions=self._dimensions,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"DashScope API error: {response.code} - {response.message}"
            )

        # Extract embeddings from response
        embeddings = []
        for item in response.output["embeddings"]:
            embeddings.append(item["embedding"])

        return embeddings

    @property
    def model(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return self._dimensions


def get_dashscope_embedding_function(
    api_key: str | None = None,
    model: str | None = None,
    dimensions: int | None = None,
) -> DashScopeEmbeddingFunction:
    """
    Factory function to create a DashScopeEmbeddingFunction instance.

    Args:
        api_key: DashScope API key
        model: Model name
        dimensions: Embedding dimensions

    Returns:
        DashScopeEmbeddingFunction instance
    """
    return DashScopeEmbeddingFunction(
        api_key=api_key,
        model=model,
        dimensions=dimensions,
    )


def generate_fused_embedding(
    text: str,
    image: str | None = None,
    api_key: str | None = None,
) -> List[float]:
    """
    Generate a fused embedding from text and optional image.

    Args:
        text: Text content
        image: Image URL or base64 (optional)
        api_key: DashScope API key

    Returns:
        Embedding vector (list of floats)
    """
    func = DashScopeEmbeddingFunction(api_key=api_key)

    input_data: Dict[str, Any] = {"text": text}
    if image:
        input_data["image"] = image

    embeddings = func([input_data])
    return embeddings[0]


def generate_text_embedding(
    text: str,
    api_key: str | None = None,
) -> List[float]:
    """
    Generate embedding from text only.

    Args:
        text: Text content
        api_key: DashScope API key

    Returns:
        Embedding vector (list of floats)
    """
    func = DashScopeEmbeddingFunction(api_key=api_key)
    embeddings = func([{"text": text}])
    return embeddings[0]


def generate_image_embedding(
    image: str,
    api_key: str | None = None,
) -> List[float]:
    """
    Generate embedding from image only.

    Args:
        image: Image URL or base64
        api_key: DashScope API key

    Returns:
        Embedding vector (list of floats)
    """
    func = DashScopeEmbeddingFunction(api_key=api_key)
    embeddings = func([{"image": image}])
    return embeddings[0]
