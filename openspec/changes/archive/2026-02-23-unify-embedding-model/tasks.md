## 1. 配置更新

- [x] 1.1 在 `libs/py_core/py_core/config.py` 添加多模态 embedding 配置
  - `multimodal_embedding_model = "qwen3-vl-embedding"`
  - `multimodal_embedding_dimensions = 1024`
  - 保留原有的 `embedding_model` 用于纯文本场景（如需要）

## 2. Embedding 函数实现

- [x] 2.1 在 `libs/py_core/py_core/utils/` 创建 `dashscope_embedding.py`
  - 实现 `DashScopeEmbeddingFunction` 类
  - 使用 `dashscope.MultiModalEmbedding.call()` API
  - 支持 Fused 模式（text + image）
  - 支持独立模式（仅 text 或仅 image）

- [x] 2.2 更新 `libs/py_core/py_core/utils/vector_db.py`
  - 导入 `DashScopeEmbeddingFunction`
  - 添加 `use_multimodal` 参数
  - 当 `use_multimodal=True` 时，使用 DashScope SDK

## 3. 数据生成脚本更新

- [x] 3.1 更新 `data/scripts/gen_image_info.py`
  - 移除重复的 `EMBEDDING_MODEL` 和 `EMBEDDING_DIMENSIONS` 配置
  - 从 `py_core.config` 导入配置（使用新的多模态模型）
  - 使用 `dashscope.MultiModalEmbedding.call()` 生成 Fused 向量
  - 输入：text (description_brief) + image (图片文件路径或 base64)
  - 输出：1024维融合向量

- [x] 3.2 更新 npz 文件格式
  - 保持 `ids`, `emb_name`, `emb_desc` 结构
  - 使用新的多模态 embedding

## 4. 卡片检索逻辑更新

- [x] 4.1 更新 `libs/py_core/py_core/system/task/card_image_matching/card_image_db_retriever.py`
  - 使用新的 DashScope embedding 函数
  - 查询时使用纯文本（会自动与存储的融合向量匹配）

## 5. 测试验证

- [x] 5.1 运行 `gen_image_info.py` 生成新的 embedding 数据
  - 成功生成 867 张卡片的多模态 embedding
  - 模型：qwen3-vl-embedding (Fused mode)
  - 维度：2560（API 返回的最大维度）
  - 已更新 config.py 和 gen_image_info.py 中的维度配置

- [x] 5.2 验证向量检索结果是否正确
  - 测试查询 "happy face" 成功返回相关图像
  - Top 1: extra_cards/emotions/happy.jpg (distance: 0.29)

- [x] 5.3 测试纯文本查询是否能正确检索到图像
  - 跨模态检索验证通过：文本 → 图像 成功

## 6. 依赖更新

- [x] 6.1 在 `libs/py_core/pyproject.toml` 添加 `dashscope` 依赖
  - 已存在: `dashscope>=1.25.5` (line 38)

- [x] 6.2 更新 `CLAUDE.md` 文档中的环境变量说明
  - 更新 DASHSCOPE_API_KEY 为必需
  - 添加 Embedding (Multimodal) 到 Key Integrations
