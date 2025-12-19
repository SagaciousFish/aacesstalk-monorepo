# AACessTalk Monorepo - 项目上下文文档

## 项目概述

AACessTalk 是一个获得 **ACM CHI 2025 最佳论文奖**的研究项目，旨在通过平板应用促进自闭症儿童与父母之间的沟通。该项目采用上下文引导和卡片推荐技术，帮助语言能力有限的自闭症儿童与父母进行有效交流。

**核心功能：**
- 为自闭症儿童提供沟通卡片推荐
- 为父母提供上下文引导建议
- 支持语音识别和语音合成（包括本地 FunASR 识别）
- 多语言翻译支持（英语、韩语、简体中文、繁体中文、粤语）

## 技术栈

### 整体架构
- **工作区管理：** NX CI Monorepo
- **移动客户端：** React Native (TypeScript)
- **后端服务：** FastAPI (Python)
- **AI 能力：** OpenAI API
- **语音服务：** CLOVA Voice API (NAVER)
- **语音识别：** FunASR Nano (本地)、CLOVA Speech Recognition API、OpenAI Whisper、阿里云语音识别
- **翻译服务：** DeepL API、阿里云翻译

### 开发环境要求
- Node.js >= 22 (推荐使用 nvm)
- Python 3.11.8 (推荐使用 pyenv)
- NX CLI (全局安装)
- UV (Python 包管理工具)
- Hatchling (Python 构建工具)

## 项目结构

```
aacesstalk-monorepo/
├── apps/
│   ├── backend/              # FastAPI 后端服务
│   ├── client-rn/           # React Native 移动客户端
│   ├── client-rn-e2e/       # React Native 端到端测试
│   ├── admin-web/           # 管理后台 Web 应用 (Vite + React)
│   ├── admin-web-e2e/       # 管理后台端到端测试
│   ├── enduser-web/         # 终端用户 Web 应用
│   └── enduser-web-e2e/     # 终端用户端到端测试
├── libs/
│   ├── py_core/             # Python 核心库 (AI处理、翻译、语音识别等)
│   ├── py_database/         # Python 数据库库
│   └── ts-core/             # TypeScript 核心库
├── data/                    # 数据文件 (卡片、语音样本等)
├── backend_data/            # 后端数据存储 (SQLite数据库)
└── logs/                    # 日志文件
```

## 构建和运行命令

### 前置准备

1. **安装全局依赖：**
   ```bash
   npm i nx -g
   ```

2. **安装项目依赖：**
   ```bash
   npm install
   nx run backend:install
   ```

### 安装脚本

1. **前端安装：**
   ```bash
   npm run setup-js
   ```

2. **后端安装：**
   ```bash
   nx run backend:setup
   ```

### Python 工具链命令

项目使用 UV 进行 Python 包管理，Ruff 进行代码检查：

- **同步依赖：**
  ```bash
  nx run backend:install  # 执行 uv sync
  ```

- **添加依赖：**
  ```bash
  nx run backend:add <package-name>
  ```

- **更新依赖：**
  ```bash
  nx run backend:update
  ```

- **代码检查：**
  ```bash
  nx run backend:lint     # 执行 ruff check
  ```

### 开发环境运行

#### 后端服务
- **开发模式：**
  ```bash
  nx run backend:run-dev
  ```

- **生产模式 (使用 Gunicorn)：**
  ```bash
  nx run backend:run-prod
  ```

- **守护进程开发模式：**
  ```bash
  nx run backend:daemon-dev
  ```

#### 移动客户端
- **Android (经过用户研究测试)：**
  ```bash
  nx run client-rn:run-android
  ```

- **iOS (未测试)：**
  ```bash
  nx run client-rn:run-ios
  ```

### 管理控制台
```bash
nx run backend:admin-console
```

### 测试命令

#### 后端测试
```bash
nx run backend:test
nx run backend:lint
```

#### Python 核心库测试
```bash
nx run py_core:test
nx run py_core:lint
nx run py_core:test_vector
nx run py_core:test_card_image_retrieval
nx run py_core:test_clova_voice
nx run py_core:test_asr
nx run py_core:test_corpus_download
```

### 数据处理工具
```bash
nx run py_core:inspect_card_translation    # 检查卡片翻译
nx run py_core:gen_card_desc               # 生成图片描述
```

## API 凭证配置

项目需要以下 API 凭证：

1. **OpenAI API Key** - AI 管道处理
2. **CLOVA Voice API** (NAVER) - 儿童卡片语音合成
   - API key
   - Secret
3. **CLOVA Speech Recognition API** (仅韩语，可选) - 语音识别
   - Invoke URL
   - Secret
4. **DeepL Translation API** (仅韩语) - 翻译服务
   - API key
5. **阿里云翻译 API** (可选) - 替代翻译服务
   - Access Key ID
   - Access Key Secret
6. **阿里云语音识别 API** (可选) - 语音识别
   - Access Key ID
   - Access Key Secret

### 环境变量配置

以下环境变量可通过 `.env` 文件配置：

- `AUTO_UPDATE_CARD_TRANSLATIONS` - 是否自动更新卡片翻译
- `ADMIN_WEB_ORIGINS` - 管理后台 Web 源配置
- `OPENAI_BASE_URL` - OpenAI API 基础 URL（可配置为代理）
- `DEEPL_API_KEY` - DeepL API 密钥
- `CLOVA_VOICE_API_KEY` - CLOVA Voice API 密钥
- `CLOVA_VOICE_SECRET` - CLOVA Voice API 密钥
- `CLOVA_SPEECH_INVOKE_URL` - CLOVA Speech 调用 URL
- `CLOVA_SPEECH_SECRET` - CLOVA Speech 密钥

**注意：** FunASR Nano 为本地语音识别模型，无需 API 密钥。

## 开发约定

### Python 代码规范
- 使用 Ruff 进行代码检查
- 使用 UV 进行包管理
- 使用 Hatchling 进行构建
- 遵循 FastAPI 最佳实践

### TypeScript/React Native 规范
- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 使用 NativeWind 进行样式管理
- 使用 Redux Toolkit 进行状态管理

### 项目配置
- 使用 NX 进行 monorepo 管理
- 每个应用都有独立的 `project.json` 配置文件
- 环境变量通过 `.env` 文件管理

## 数据文件说明

### `data/` 目录
- `cards/` - 沟通卡片图片资源
- `given/` - 预训练数据和翻译字典
- `samples/` - 语音和图片样本
- `default_core_cards.yml` - 核心卡片数据（支持英、韩、中简、中繁、粤语5种语言）
- `default_emotion_cards.yml` - 情绪卡片数据
- `initial_parent_guides.yml` - 家长引导内容
- `parent_example_translation_samples.yml` - 翻译示例

### `backend_data/` 目录
- `database/` - SQLite 数据库文件
- `user_data/` - 用户数据存储

## 功能模块

### FunASR Nano 语音识别
- **本地推理：** 使用 "Fun-ASR-Nano-2512" 模型，无需外部 API 密钥
- **GPU/CPU 支持：** 自动选择可用设备
- **集成架构：** 作为 `IntegrationService` 的一部分统一管理

### 集成服务统一架构
- **服务基类：** `IntegrationService` 提供标准化接口
- **子类实现：** `AACCorpusDownloader`, `DeepLTranslator`, `AliyunTranslator`, `WhisperSpeechRecognizer`, `ClovaVoice`, `ClovaSpeech`, `AliyunSpeechRecognizer`
- **认证管理：** `APIAuthorizationVariableSpec` 统一管理 API 凭证

### 多供应商语音识别栈
- **FunASR Nano：** 本地识别，无网络依赖
- **CLOVA Speech：** 韩语语音识别
- **OpenAI Whisper：** 通用语音识别
- **阿里云语音识别：** 中文语音识别

### 多语言翻译支持
- **支持语言：** 英语、韩语、简体中文、繁体中文、粤语
- **翻译服务：** DeepL API、阿里云翻译 API
- **卡片数据：** 所有卡片数据均支持多语言翻译

## 故障排除

### 常见问题
1. **Python 版本问题：** 确保使用 Python 3.11.8
2. **Node.js 版本问题：** 确保使用 Node.js >= 22
3. **API 凭证缺失：** 检查所有必需的 API 凭证是否已配置
4. **端口冲突：** 后端默认运行在 3000 端口
5. **UV 工具链问题：** 项目使用 UV 而非 Poetry，确保运行 `nx run backend:install` 而非 `poetry install`
6. **Ruff 代码检查：** 代码检查使用 Ruff 而非 Flake8，配置文件为 `apps/backend/.flake8`
7. **环境变量配置：** 确保正确配置所有环境变量，特别是多供应商 API 凭证
8. **FunASR 模型下载：** 首次运行会自动下载 FunASR Nano 模型，确保网络连接

### 日志查看
- 后端日志：`logs/` 目录
- 应用日志：各应用内部日志文件

## 研究引用

如需引用此项目，请使用以下格式：

```bibtex
@inproceedings{choi2025aacesstalk,
  title={AACessTalk: Fostering Communication between Minimally Verbal Autistic Children and Parents with Contextual Guidance and Card Recommendation},
  author={Dasom Choi and SoHyun Park and Kyungah Lee and Hwajung Hong and Young-Ho Kim},
  year={2025},
  publisher={Association for Computing Machinery},
  address={New York, NY, USA},
  url={https://doi.org/10.1145/3706598.3713792},
  doi={10.1145/3706598.3713792},
  booktitle={Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems},
  location={Yokohama, Japan},
  series={CHI '25}
}
```

## 维护团队

- **通讯作者：** Young-Ho Kim (NAVER AI Lab)
- **研究团队：** Dasom Choi, SoHyun Park, Kyungah Lee, Hwajung Hong

---

*最后更新：2025-12-19*  
*此文档基于项目实际配置和代码分析生成，已同步最新工具链和功能模块*