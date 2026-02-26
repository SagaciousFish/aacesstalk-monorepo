## Why

当前项目存在以下问题：
1. Embedding 模型配置分散在多个文件中，容易产生不一致
2. ChromaDB 使用 `text-embedding-v4` 仅支持文本，无法处理图像向量
3. 卡片图像检索使用的是"图像描述文本→文本embedding"的方式，而非真正的多模态 embedding
4. 需要统一使用阿里云百炼的多模态 embedding 模型来提升图像检索效果

## What Changes

1. **统一 embedding 模型配置**
   - 在 `libs/py_core/py_core/config.py` 中添加多模态 embedding 模型配置
   - 移除 `data/scripts/gen_image_info.py` 中的重复配置

2. **使用真正的多模态 embedding**
   - 将 `text-embedding-v4` 替换为 `qwen3-vl-embedding`（支持 Fused 模式）
   - 更新向量数据库 `libs/py_core/py_core/utils/vector_db.py` 使用 DashScope SDK
   - 更新图像信息生成脚本 `data/scripts/gen_image_info.py` 生成多模态 embedding

3. **重新生成卡片 embedding 数据**
   - 使用新的多模态模型重新生成 `cards_image_desc_embeddings.npz`

## Capabilities

### New Capabilities
- `multimodal-embedding`: 使用阿里云百炼 `qwen3-vl-embedding` 模型生成多模态向量，支持文本+图像融合检索

### Modified Capabilities
- `card-image-retrieval`: 现有的卡片图像检索能力需要更新为使用多模态 embedding

## Impact

- **修改的文件**:
  - `libs/py_core/py_core/config.py` - 添加多模态 embedding 配置
  - `libs/py_core/py_core/utils/vector_db.py` - 使用 DashScope SDK 生成 embedding
  - `data/scripts/gen_image_info.py` - 统一配置，使用多模态 embedding
  - `data/cards_image_desc_embeddings.npz` - 重新生成

- **依赖**:
  - `dashscope` Python SDK
  - `DASHSCOPE_API_KEY` 环境变量

- **不涉及**:
  - Convex 相关代码（实验性，不在此次修改范围内）
