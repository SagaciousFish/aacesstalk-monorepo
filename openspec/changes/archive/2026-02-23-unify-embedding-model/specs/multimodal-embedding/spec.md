## ADDED Requirements

### Requirement: Multimodal embedding generation
The system SHALL use DashScope's qwen3-vl-embedding model to generate multimodal embeddings for card images.

#### Scenario: Generate text embedding
- **WHEN** a text string is provided for embedding
- **THEN** the system returns a 1024-dimensional vector using qwen3-vl-embedding model

#### Scenario: Generate image embedding
- **WHEN** an image is provided for embedding
- **THEN** the system returns a 1024-dimensional vector using qwen3-vl-embedding model

#### Scenario: Generate fused text+image embedding
- **WHEN** both text and image are provided for embedding
- **THEN** the system returns a single 1024-dimensional fused vector that represents both modalities

### Requirement: Unified embedding configuration
The system SHALL maintain all embedding-related configuration in a central location.

#### Scenario: Access embedding model configuration
- **WHEN** any component requests the embedding model configuration
- **THEN** the system returns values from AACessTalkConfig defined in libs/py_core/py_core/config.py

### Requirement: Embedding generation via DashScope SDK
The system SHALL use DashScope SDK (not OpenAI compatibility API) for multimodal embedding generation.

#### Scenario: Initialize embedding client
- **WHEN** the embedding client is initialized
- **THEN** the system uses DashScope SDK with DASHSCOPE_API_KEY from environment variables

#### Scenario: Generate embedding with specified dimensions
- **WHEN** embedding is generated with custom dimensions parameter
- **THEN** the system returns a vector with the exact requested dimensions (1024)
