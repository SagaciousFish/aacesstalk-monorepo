# AACessTalk Monorepo - 项目上下文文档

## 项目概述

AACessTalk 是一个获得 **ACM CHI 2025 最佳论文奖**的研究项目，旨在通过平板应用促进自闭症儿童与父母之间的沟通。该项目采用上下文引导和卡片推荐技术，帮助语言能力有限的自闭症儿童与父母进行有效交流。

**核心功能：**
- 为自闭症儿童提供沟通卡片推荐
- 为父母提供上下文引导建议
- 支持语音识别和语音合成
- 多语言翻译支持（特别是韩语）

## 技术栈

### 整体架构
- **工作区管理：** NX CI Monorepo
- **移动客户端：** React Native (TypeScript)
- **后端服务：** FastAPI (Python)
- **AI 能力：** OpenAI API
- **语音服务：** CLOVA Voice API (NAVER)
- **语音识别：** CLOVA Speech Recognition API 或 OpenAI Whisper
- **翻译服务：** DeepL API

### 开发环境要求
- Node.js >= 22 (推荐使用 nvm)
- Python 3.11.8 (推荐使用 pyenv)
- NX CLI (全局安装)
- Poetry (Python 包管理)
- UV (Python 包管理工具)

## 项目结构

```
aacesstalk-monorepo/
├── apps/
│   ├── backend/              # FastAPI 后端服务
│   ├── client-rn/           # React Native 移动客户端
│   ├── admin-web/           # 管理后台 Web 应用
│   └── enduser-web/         # 终端用户 Web 应用
├── libs/
│   ├── py_core/             # Python 核心库 (AI 处理、翻译等)
│   ├── py_database/         # Python 数据库库
│   └── ts-core/             # TypeScript 核心库
├── data/                    # 数据文件 (卡片、语音样本等)
├── backend_data/            # 后端数据存储
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

## 开发约定

### Python 代码规范
- 使用 Flake8 进行代码检查
- 使用 Poetry 进行包管理
- 使用 UV 进行依赖同步
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
- `cards/` - 沟通卡片数据
- `given/` - 预训练数据和翻译字典
- `samples/` - 语音和图片样本

### `backend_data/` 目录
- `database/` - SQLite 数据库文件
- `user_data/` - 用户数据存储

## 故障排除

### 常见问题
1. **Python 版本问题：** 确保使用 Python 3.11.8
2. **Node.js 版本问题：** 确保使用 Node.js >= 22
3. **API 凭证缺失：** 检查所有必需的 API 凭证是否已配置
4. **端口冲突：** 后端默认运行在 3000 端口

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

*最后更新：2025-12-14*  
*此文档基于项目 README 和配置文件分析生成*