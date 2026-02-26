## Context

当前项目使用 `text-embedding-v4` 模型进行文本向量化和检索，但存在以下问题：

1. **仅支持文本 embedding**：当前系统只能处理文本，无法直接处理图像向量
2. **配置分散**：`libs/py_core/py_core/config.py` 和 `data/scripts/gen_image_info.py` 都有独立的 embedding 配置
3. **检索精度受限**：卡片图像检索使用的是"图像描述文本→文本 embedding"的方式，而非真正的多模态 embedding

目标：使用阿里云百炼的 `qwen3-vl-embedding` 多模态模型统一所有 embedding 计算。

## Goals / Non-Goals

**Goals:**
- 统一 embedding 模型为 `qwen3-vl-embedding`
- 使用 DashScope SDK 替代 OpenAI SDK 进行 embedding 生成
- 消除配置文件中的重复设置
- 支持图像+文本融合向量（Fused Mode）进行跨模态检索

**Non-Goals:**
- 不修改现有的卡片图像匹配逻辑（仅修改 embedding 生成方式）
- 不修改 ChromaDB 的使用方式
- 不涉及 Convex 相关代码（实验性功能）

## Decisions

### 1. 选择 `qwen3-vl-embedding` 而非 `multimodal-embedding-v1`

**选择**: `qwen3-vl-embedding` (Fused Mode, 1024 dimensions)

**理由**:
- `qwen3-vl-embedding` 支持 Fused 模式，可以将文本+图像融合为一个向量
- 支持更长的文本输入（32K tokens vs 512 tokens）
- 支持更高维度（最高 2560）
- 适合跨模态检索场景

**备选方案考虑**:
- `multimodal-embedding-v1`: 仅支持独立向量，不支持融合，文本限制 512 tokens
- `text-embedding-v4`: 仅支持文本，无法处理图像

### 2. 使用 DashScope SDK 而非 OpenAI 兼容 API

**理由**:
- 多模态 embedding API 不支持 OpenAI 兼容格式
- DashScope SDK 是官方推荐方式

### 3. 配置集中管理

**方案**: 在 `libs/py_core/py_core/config.py` 中统一定义所有 embedding 相关配置

**理由**:
- 消除重复配置
- 便于后续维护和修改

## Risks / Trade-offs

### 1. 向量维度变化

**[风险]**: `qwen3-vl-embedding` 默认 1024 维度与现有 ChromaDB 存储可能兼容

**[缓解]**: 显式指定 `dimensions=1024` 参数确保兼容

### 2. 重新生成 embedding 数据

**[风险]**: 需要重新运行 embedding 生成脚本，生成新的 `cards_image_desc_embeddings.npz`

**[缓解]**: 脚本支持 `--resume` 参数，可以增量处理

### 3. API 调用方式变化

**[风险]**: 从 OpenAI 兼容 API 切换到 DashScope SDK，代码改动较大

**[缓解]**: 封装统一的 embedding 生成函数，最小化调用方代码改动

## Migration Plan

1. **更新配置** (`libs/py_core/py_core/config.py`)
   - 添加 `multimodal_embedding_model` 和 `multimodal_embedding_dimensions`

2. **更新 vector_db.py**
   - 添加 DashScope SDK 依赖
   - 创建 `DashScopeEmbeddingFunction` 类
   - 支持 Fused 模式（文本+图像）

3. **更新 gen_image_info.py**
   - 移除重复的 embedding 配置
   - 使用 `qwen3-vl-embedding` 生成融合向量
   - 更新 npz 文件格式

4. **测试验证**
   - 运行 embedding 生成脚本
   - 验证向量检索结果

5. **部署**
   - 更新生产环境 `DASHSCOPE_API_KEY`
   - 部署更新后的代码和数据
